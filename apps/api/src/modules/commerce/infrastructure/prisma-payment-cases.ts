import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import {CheckoutConflict,CheckoutUnavailable} from '../domain/checkout.js';
import {remainingRefundable,type CaseAction} from '../domain/payment-case.js';
import type {PaymentCaseRepository,PaymentCaseView} from '../application/payment-case-ports.js';
const select={id:true,title:true,priceCOP:true,status:true,paymentReference:true,student:{select:{name:true}},entitlement:{select:{revokedAt:true}},checkout:{select:{environment:true,providerStatus:true,resolution:true,providerTransactionId:true}},paymentCase:{select:{status:true,category:true}}} as const;
type Order=Prisma.PackageOrderGetPayload<{select:typeof select}>;
function eligible(row:Order){
 // A fulfilled order is evidence of recorded payment, not proof of funds returned.
 return row.status==='FULFILLED'&&!!row.paymentReference&&(!row.checkout||(row.checkout.environment==='prod'&&!!row.checkout.providerTransactionId&&['APPROVED','VOIDED'].includes(row.checkout.providerStatus)));
}
async function allow(tx:Prisma.TransactionClient,w:string,u:string){
 if(!await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:u,role:{in:['OWNER','ADMIN']}},select:{id:true}}))throw new CheckoutUnavailable('Payment case unavailable');
}
const scope=(w:string)=>({workspaceId:w,package:{workspaceId:w}});
async function view(tx:Prisma.TransactionClient,row:Order,detail=false):Promise<PaymentCaseView>{
 const total=await tx.packagePaymentCaseEntry.aggregate({where:{orderId:row.id,kind:'REFUND_RECORDED'},_sum:{amountCOP:true}});
 const recordedRefundCOP=total._sum.amountCOP??0;
 const entries=detail?await tx.packagePaymentCaseEntry.findMany({where:{orderId:row.id},orderBy:[{createdAt:'desc'},{id:'desc'}],take:100,select:{id:true,kind:true,actorUserId:true,note:true,amountCOP:true,externalReference:true,createdAt:true}}):[];
 return {orderId:row.id,title:row.title,studentName:row.student.name,priceCOP:row.priceCOP,orderStatus:row.status,checkoutEnvironment:row.checkout?.environment??null,providerStatus:row.checkout?.providerStatus??null,checkoutResolution:row.checkout?.resolution??null,caseStatus:row.paymentCase?.status??null,category:row.paymentCase?.category??null,recordedRefundCOP,refundableCOP:eligible(row)?remainingRefundable(row.priceCOP,recordedRefundCOP):0,entitlementRevoked:row.entitlement?!!row.entitlement.revokedAt:null,entries};
}
export class PrismaPaymentCases implements PaymentCaseRepository{
 async list(w:string,u:string,after:string|null){
  return prisma.$transaction(async tx=>{
   await allow(tx,w,u);
   const rows=await tx.packageOrder.findMany({where:{...scope(w),OR:[{status:'FULFILLED'},{checkout:{is:{resolution:'REVIEW_REQUIRED'}}},{paymentCase:{isNot:null}}],...(after?{id:{gt:after}}:{})},orderBy:{id:'asc'},take:50,select});
   return Promise.all(rows.map(row=>view(tx,row)));
  },{timeout:15000});
 }
 async detail(w:string,u:string,id:string){
  return prisma.$transaction(async tx=>{await allow(tx,w,u);const row=await tx.packageOrder.findFirst({where:{...scope(w),id},select});if(!row)throw new CheckoutUnavailable('Payment case unavailable');return view(tx,row,true);});
 }
 async apply(w:string,u:string,id:string,input:CaseAction){
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:order:id:'+id}))::text`;
   await allow(tx,w,u);
   const row=await tx.packageOrder.findFirst({where:{...scope(w),id},select});if(!row)throw new CheckoutUnavailable('Payment case unavailable');
   const prior=await tx.packagePaymentCaseEntry.findUnique({where:{requestId:input.requestId}});
   const kind=({open:'OPEN',note:'NOTE',close:'CLOSE',reopen:'REOPEN',recordRefund:'REFUND_RECORDED'} as const)[input.action];
   const amount=input.action==='recordRefund'?input.amountCOP:null;
   const reference=input.action==='recordRefund'?input.externalReference:null;
   if(prior){
    if(prior.orderId!==id||prior.actorUserId!==u||prior.kind!==kind||prior.note!==input.note||prior.amountCOP!==amount||prior.externalReference!==reference||(input.action==='open'&&row.paymentCase?.category!==input.category))throw new CheckoutConflict('Request key already used');
    return view(tx,row,true);
   }
   if(input.action==='open'){
    if(row.paymentCase)throw new CheckoutConflict('A case already exists; reopen if closed');
    if(row.status!=='FULFILLED'&&row.checkout?.resolution!=='REVIEW_REQUIRED')throw new CheckoutConflict('Order is not eligible for a payment case');
    await tx.packagePaymentCase.create({data:{orderId:id,category:input.category,openedByUserId:u}});
   }else{
    if(!row.paymentCase)throw new CheckoutConflict('Open a case first');
    if(input.action==='reopen'){
     if(row.paymentCase.status!=='CLOSED')throw new CheckoutConflict('Case is already open');
     await tx.packagePaymentCase.update({where:{orderId:id},data:{status:'OPEN',closedAt:null}});
    }else{
     if(row.paymentCase.status!=='OPEN')throw new CheckoutConflict('Case is closed');
     if(input.action==='close')await tx.packagePaymentCase.update({where:{orderId:id},data:{status:'CLOSED',closedAt:new Date()}});
     if(input.action==='recordRefund'){
      if(!eligible(row))throw new CheckoutConflict('Only recorded real payments can have refund records');
      const total=await tx.packagePaymentCaseEntry.aggregate({where:{orderId:id,kind:'REFUND_RECORDED'},_sum:{amountCOP:true}});
      if(input.amountCOP>remainingRefundable(row.priceCOP,total._sum.amountCOP??0))throw new CheckoutConflict('Refund exceeds recorded payment');
      if(await tx.packagePaymentCaseEntry.findFirst({where:{orderId:id,externalReference:input.externalReference},select:{id:true}}))throw new CheckoutConflict('Refund reference already recorded');
     }
    }
   }
   await tx.packagePaymentCaseEntry.create({data:{orderId:id,requestId:input.requestId,actorUserId:u,kind,note:input.note,amountCOP:amount,externalReference:reference}});
   const current=await tx.packageOrder.findUniqueOrThrow({where:{id},select});return view(tx,current,true);
  });
 }
}
