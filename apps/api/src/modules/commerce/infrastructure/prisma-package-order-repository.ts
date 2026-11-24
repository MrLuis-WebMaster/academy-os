import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import {notifyUser} from '../../notifications/infrastructure/personal-notice-publisher.js';
import {grantExpiry} from '../domain/class-package.js';
import {OrderDenied,OrderMissing,OrderConflict,type CreateOrder,type ReviewOrder} from '../domain/package-order.js';
import type {PackageOrderRepository} from '../application/order-ports.js';

const select={id:true,packageId:true,title:true,priceCOP:true,credits:true,validDays:true,status:true,createdAt:true,reviewedAt:true,entitlementId:true} as const;
async function allow(tx:Prisma.TransactionClient,w:string,u:string,manager=false){
 const member=await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:u,role:{in:manager?['OWNER','ADMIN']:['STUDENT']}},select:{id:true}});
 if(!member)throw new OrderDenied('Purchase access denied');
}
async function lock(tx:Prisma.TransactionClient,key:string){await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:order:'+key}))::text`;}
function eligible(w:string,u:string):Prisma.ClassPackageWhereInput{
 return {workspaceId:w,active:true,priceCOP:{gt:0},OR:[
  {courseRestricted:false,courseId:null},
  {courseRestricted:true,course:{is:{workspaceId:w,enrollments:{some:{userId:u}}}}},
 ]};
}
export class PrismaPackageOrderRepository implements PackageOrderRepository{
 async catalog(w:string,u:string){
  return prisma.$transaction(async tx=>{await allow(tx,w,u);return tx.classPackage.findMany({where:eligible(w,u),
   select:{id:true,title:true,courseId:true,sessionCredits:true,priceCOP:true,validDays:true},orderBy:{createdAt:'desc'},take:150});});
 }
 async mine(w:string,u:string){
  return prisma.$transaction(async tx=>{await allow(tx,w,u);return tx.packageOrder.findMany({where:{workspaceId:w,studentUserId:u,package:{workspaceId:w}},select,orderBy:{createdAt:'desc'},take:100});});
 }
 async create(w:string,u:string,input:CreateOrder){
  return prisma.$transaction(async tx=>{
   await lock(tx,'student:'+w+':'+u);await allow(tx,w,u);
   const previous=await tx.packageOrder.findUnique({where:{workspaceId_studentUserId_requestId:{workspaceId:w,studentUserId:u,requestId:input.requestId}},select});
   if(previous){
    if(previous.packageId!==input.packageId||previous.priceCOP!==input.expectedPriceCOP)throw new OrderConflict('Request key already used');
    return previous;
   }
   const plan=await tx.classPackage.findFirst({where:{...eligible(w,u),id:input.packageId},select:{id:true,title:true,priceCOP:true,sessionCredits:true,validDays:true,courseId:true}});
   if(!plan)throw new OrderMissing('Package not available');
   if(plan.priceCOP!==input.expectedPriceCOP)throw new OrderConflict('Price changed; refresh the catalog');
   const pending=await tx.packageOrder.findFirst({where:{workspaceId:w,studentUserId:u,packageId:plan.id,status:'PENDING'},select});
   if(pending)return pending;
   if(await tx.packageOrder.count({where:{workspaceId:w,studentUserId:u,status:'PENDING'}})>=10)throw new OrderConflict('Too many pending orders');
   return tx.packageOrder.create({data:{workspaceId:w,studentUserId:u,packageId:plan.id,requestId:input.requestId,title:plan.title,priceCOP:plan.priceCOP,credits:plan.sessionCredits,validDays:plan.validDays,courseIdSnapshot:plan.courseId},select});
  });
 }
 async cancel(w:string,u:string,id:string){
  return prisma.$transaction(async tx=>{
   await lock(tx,'id:'+id);await allow(tx,w,u);
   const row=await tx.packageOrder.findFirst({where:{id,workspaceId:w,studentUserId:u,package:{workspaceId:w}},select});
   if(!row)throw new OrderMissing('Order not available');
   if(row.status==='CANCELLED')return row;
   if(row.status!=='PENDING')throw new OrderConflict('Only pending orders can be cancelled');
   return tx.packageOrder.update({where:{id},data:{status:'CANCELLED'},select});
  });
 }
 async list(w:string,u:string){
  return prisma.$transaction(async tx=>{await allow(tx,w,u,true);return tx.packageOrder.findMany({
   where:{workspaceId:w,package:{workspaceId:w}},select:{...select,student:{select:{name:true}},paymentReference:true,reviewNote:true,reviewer:{select:{name:true}}},orderBy:{createdAt:'desc'},take:200});});
 }
 async review(w:string,u:string,id:string,input:ReviewOrder){
  return prisma.$transaction(async tx=>{
   await lock(tx,'id:'+id);await allow(tx,w,u,true);
   const row=await tx.packageOrder.findFirst({where:{id,workspaceId:w,package:{workspaceId:w}},select:{...select,studentUserId:true,courseIdSnapshot:true,paymentReference:true}});
   if(!row)throw new OrderMissing('Order not available');
   if(row.status==='FULFILLED'&&input.action==='fulfill'&&row.paymentReference===input.paymentReference&&row.priceCOP===input.amountCOP){
    const {studentUserId,courseIdSnapshot,paymentReference,...view}=row;return view;
   }
   if(row.status!=='PENDING')throw new OrderConflict('Order has already been resolved');
   const now=new Date();
   if(input.action==='reject')return tx.packageOrder.update({where:{id},data:{status:'REJECTED',reviewedByUserId:u,reviewNote:input.note,reviewedAt:now},select});
   if(input.amountCOP!==row.priceCOP)throw new OrderConflict('Amount must match the original order');
   await lock(tx,'reference:'+w+':'+input.paymentReference);
   if(await tx.packageOrder.findFirst({where:{workspaceId:w,paymentReference:input.paymentReference},select:{id:true}}))throw new OrderConflict('Payment reference already used');
   await allow(tx,w,row.studentUserId);
   const plan=await tx.classPackage.findFirst({where:{workspaceId:w,id:row.packageId},select:{courseId:true,courseRestricted:true,active:true}});
   if(!plan||!plan.active||plan.courseId!==row.courseIdSnapshot||plan.courseRestricted!==Boolean(row.courseIdSnapshot))throw new OrderConflict('Package changed or was disabled; resolve payment externally');
   if(row.courseIdSnapshot&&!await tx.enrollment.findFirst({where:{userId:row.studentUserId,courseId:row.courseIdSnapshot,course:{workspaceId:w}},select:{id:true}}))throw new OrderConflict('Student is no longer enrolled');
   const grant=await tx.classPackageEntitlement.create({data:{
    workspaceId:w,packageId:row.packageId,studentUserId:row.studentUserId,issuedByUserId:u,
    requestId:'order:'+id,credits:row.credits,expiresAt:grantExpiry(now,row.validDays),note:'External payment recorded via order '+id,
   },select:{id:true}});
   const result=await tx.packageOrder.update({where:{id},data:{status:'FULFILLED',entitlementId:grant.id,paymentReference:input.paymentReference,reviewNote:input.note,reviewedAt:now,reviewedByUserId:u},select});
   await notifyUser(tx,{workspaceId:w,userId:row.studentUserId,kind:'PACKAGE_ISSUED',eventKey:'package-issued:'+grant.id,title:'Tu paquete de clases está disponible',body:'Tu academia registró el pago externo de tu solicitud. Consulta los créditos y la vigencia.'});
   return result;
  });
 }
}
