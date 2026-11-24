import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {CheckoutRepository} from '../application/checkout-ports.js';
import {amountInCents,CheckoutConflict,CheckoutUnavailable,type CheckoutConfig,type VerifiedTransaction} from '../domain/checkout.js';
import {grantExpiry} from '../domain/class-package.js';
import {notifyUser} from '../../notifications/infrastructure/personal-notice-publisher.js';

async function lock(tx:Prisma.TransactionClient,id:string){
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:order:id:'+id}))::text`;
}
async function student(tx:Prisma.TransactionClient,w:string,u:string){
 return !!await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:u,role:'STUDENT'},select:{id:true}});
}
export class PrismaPackageCheckoutRepository implements CheckoutRepository{
 async list(w:string,u:string){
  return prisma.$transaction(async tx=>{
   if(!await student(tx,w,u))throw new CheckoutUnavailable('Checkout not available');
   return tx.packageCheckout.findMany({where:{order:{workspaceId:w,studentUserId:u,package:{workspaceId:w}}},orderBy:{createdAt:'desc'},take:100});
  });
 }
 async target(w:string,u:string,id:string,manager:boolean){
  return prisma.$transaction(async tx=>{
   const role=manager?{in:['OWNER','ADMIN'] as const}:{in:['STUDENT'] as const};
   const access=await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:u,role:{in:[...role.in]}},select:{id:true}});
   if(!access)throw new CheckoutUnavailable('Checkout not available');
   const row=await tx.packageCheckout.findFirst({where:{orderId:id,order:{workspaceId:w,package:{workspaceId:w},...(manager?{}:{studentUserId:u})}}});
   if(!row)throw new CheckoutUnavailable('Checkout not available');
   return row;
  });
 }
 async create(w:string,u:string,id:string,config:CheckoutConfig,reference:string,expiresAt:Date){
  return prisma.$transaction(async tx=>{
   await lock(tx,id);
   if(config.workspaceId!==w||!await student(tx,w,u))throw new CheckoutUnavailable('Checkout not available');
   if(config.environment==='prod'&&(!config.issuerId||!await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:config.issuerId,role:'OWNER',user:{emailVerified:true}},select:{id:true}})))throw new CheckoutUnavailable('Merchant owner not available');
   const order=await tx.packageOrder.findFirst({where:{id,workspaceId:w,studentUserId:u,status:'PENDING',package:{workspaceId:w,active:true}},include:{checkout:true,package:{select:{courseId:true,courseRestricted:true}}}});
   if(!order)throw new CheckoutUnavailable('Order not available');
   if(order.package.courseId!==order.courseIdSnapshot||order.package.courseRestricted!==Boolean(order.courseIdSnapshot))throw new CheckoutConflict('Package changed');
   if(order.courseIdSnapshot&&!await tx.enrollment.findFirst({where:{courseId:order.courseIdSnapshot,userId:u,course:{workspaceId:w}},select:{id:true}}))throw new CheckoutUnavailable('Course not available');
   if(order.checkout){
    if(order.checkout.merchantKeyHash!==config.merchantKeyHash||order.checkout.environment!==config.environment)throw new CheckoutConflict('Merchant configuration changed');
    return order.checkout;
   }
   return tx.packageCheckout.create({data:{orderId:id,reference,merchantKeyHash:config.merchantKeyHash,environment:config.environment,amountInCents:BigInt(amountInCents(order.priceCOP)),expiresAt}});
  });
 }
 async apply(config:CheckoutConfig,payment:VerifiedTransaction){
  return prisma.$transaction(async tx=>{
   const scoped={reference:payment.reference,environment:config.environment,merchantKeyHash:config.merchantKeyHash,order:{workspaceId:config.workspaceId,package:{workspaceId:config.workspaceId}}};
   const candidate=await tx.packageCheckout.findFirst({where:scoped,select:{orderId:true}});
   if(!candidate)return {handled:false,resolution:'UNKNOWN_REFERENCE'};
   await lock(tx,candidate.orderId);
   const row=await tx.packageCheckout.findFirst({where:scoped,include:{order:true}});
   if(!row)return {handled:false,resolution:'UNKNOWN_REFERENCE'};
   // Keep prior void or review states sticky, even if an earlier provider read arrives late.
   if(row.providerStatus==='VOIDED'||row.resolution==='REVIEW_REQUIRED')return {handled:true,resolution:row.resolution};
   const update=async(resolution:string,status=payment.status,bind=true)=>{
    await tx.packageCheckout.update({where:{orderId:row.orderId},data:{providerStatus:status,resolution,verifiedAt:new Date(),...(bind?{providerTransactionId:payment.id}:{})}});
    return {handled:true,resolution};
   };
   if(await tx.packageCheckout.findFirst({where:{providerTransactionId:payment.id,orderId:{not:row.orderId}},select:{orderId:true}}))return update('REVIEW_REQUIRED',row.providerStatus as VerifiedTransaction['status'],false);
   if(row.providerTransactionId&&row.providerTransactionId!==payment.id)return update('REVIEW_REQUIRED',row.providerStatus as VerifiedTransaction['status'],false);
   if(row.amountInCents!==BigInt(payment.amountInCents)||payment.currency!=='COP')return update('REVIEW_REQUIRED');
   if(row.providerStatus==='APPROVED'){
    if(payment.status==='VOIDED')return update('REVIEW_REQUIRED');
    return {handled:true,resolution:row.resolution};
   }
   if(['DECLINED','ERROR'].includes(row.providerStatus)&&payment.status==='PENDING')return {handled:true,resolution:row.resolution};
   if(payment.status==='VOIDED')return update('REVIEW_REQUIRED');
   if(payment.status==='PENDING')return update('WAITING');
   if(payment.status!=='APPROVED')return update('NOT_PAID');
   // Sandbox is never eligible for delivery of real credits.
   if(config.environment==='test')return update('TEST_APPROVED');
   const order=row.order,w=order.workspaceId,issuer=config.issuerId;
   if(order.status!=='PENDING'||!issuer||!await student(tx,w,order.studentUserId))return update('REVIEW_REQUIRED');
   const [owner,plan]=await Promise.all([
    tx.workspaceMember.findFirst({where:{workspaceId:w,userId:issuer,role:'OWNER',user:{emailVerified:true}},select:{id:true}}),
    tx.classPackage.findFirst({where:{id:order.packageId,workspaceId:w,active:true},select:{courseId:true,courseRestricted:true}}),
   ]);
   if(!owner||!plan||plan.courseId!==order.courseIdSnapshot||plan.courseRestricted!==Boolean(order.courseIdSnapshot))return update('REVIEW_REQUIRED');
   if(order.courseIdSnapshot&&!await tx.enrollment.findFirst({where:{courseId:order.courseIdSnapshot,userId:order.studentUserId,course:{workspaceId:w}},select:{id:true}}))return update('REVIEW_REQUIRED');
   const reference='WOMPI:'+payment.id.toUpperCase();
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:order:reference:'+w+':'+reference}))::text`;
   if(await tx.packageOrder.findFirst({where:{workspaceId:w,paymentReference:reference},select:{id:true}}))return update('REVIEW_REQUIRED');
   const now=new Date();
   const grant=await tx.classPackageEntitlement.create({data:{workspaceId:w,packageId:order.packageId,studentUserId:order.studentUserId,issuedByUserId:issuer,requestId:'order:'+order.id,credits:order.credits,expiresAt:grantExpiry(now,order.validDays),note:'Verified Wompi payment '+row.reference},select:{id:true}});
   await tx.packageOrder.update({where:{id:order.id},data:{status:'FULFILLED',entitlementId:grant.id,paymentReference:reference,reviewedByUserId:issuer,reviewedAt:now,reviewNote:'Verified Wompi payment; configured owner attribution'}});
   await notifyUser(tx,{workspaceId:w,userId:order.studentUserId,kind:'PACKAGE_ISSUED',eventKey:'package-issued:'+grant.id,title:'Pago confirmado',body:'Tu paquete de clases está disponible.'});
   return update('FULFILLED');
  });
 }
}
