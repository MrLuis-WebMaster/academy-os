import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {parseCaseAction,remainingRefundable} from '../modules/commerce/domain/payment-case.js';
import {CheckoutConflict,CheckoutUnavailable} from '../modules/commerce/domain/checkout.js';
import {PrismaPaymentCases} from '../modules/commerce/infrastructure/prisma-payment-cases.js';
import {PrismaPackageOrderRepository} from '../modules/commerce/infrastructure/prisma-package-order-repository.js';
test('refund inputs require explicit external confirmation and valid integer amount',()=>{
 const raw={action:'recordRefund',requestId:randomUUID(),note:'External refund confirmed',amountCOP:10000,externalReference:'refund-123'};
 assert.throws(()=>parseCaseAction(raw),CheckoutConflict);
 assert.throws(()=>parseCaseAction({...raw,confirmedExternalRefund:true,amountCOP:1.5}),CheckoutConflict);
 const action=parseCaseAction({...raw,confirmedExternalRefund:true});
 assert.equal(action.action,'recordRefund');
 if(action.action==='recordRefund')assert.equal(action.externalReference,'REFUND-123');
 assert.equal(remainingRefundable(100,120),0);
});
test('PostgreSQL: partial refunds serialize, replay is idempotent and cases are isolated',async()=>{
 const nonce=randomUUID().slice(0,12);
 const [owner,student,other]=await Promise.all([
  prisma.user.create({data:{name:'Owner',email:'case-owner-'+nonce+'@example.invalid',emailVerified:true}}),
  prisma.user.create({data:{name:'Student',email:'case-student-'+nonce+'@example.invalid',emailVerified:true}}),
  prisma.user.create({data:{name:'Other',email:'case-other-'+nonce+'@example.invalid',emailVerified:true}}),
 ]);
 const ids:string[]=[];
 try{
  const w=await prisma.workspace.create({data:{name:'A',slug:'case-a-'+nonce,type:'ACADEMY',members:{create:[{userId:owner.id,role:'OWNER'},{userId:student.id,role:'STUDENT'}]}}});ids.push(w.id);
  const b=await prisma.workspace.create({data:{name:'B',slug:'case-b-'+nonce,type:'ACADEMY',members:{create:{userId:other.id,role:'OWNER'}}}});ids.push(b.id);
  const plan=await prisma.classPackage.create({data:{workspaceId:w.id,title:'Classes',priceCOP:100000,sessionCredits:4,validDays:30}});
  const orders=new PrismaPackageOrderRepository();
  const order=await orders.create(w.id,student.id,{packageId:plan.id,requestId:randomUUID(),expectedPriceCOP:100000});
  await orders.review(w.id,owner.id,order.id,{action:'fulfill',amountCOP:100000,paymentReference:'EXT-'+nonce,confirmedExternalPayment:true,note:'Payment checked externally'});
  const repo=new PrismaPaymentCases(),apply=(raw:unknown)=>repo.apply(w.id,owner.id,order.id,parseCaseAction(raw));
  const open={action:'open',category:'REFUND',requestId:randomUUID(),note:'Refund requested by student'};
  await assert.rejects(()=>repo.apply(w.id,student.id,order.id,parseCaseAction(open)),CheckoutUnavailable);
  await assert.rejects(()=>repo.detail(b.id,other.id,order.id),CheckoutUnavailable);
  await apply(open);await apply(open);
  const refund=(amountCOP:number,externalReference:string)=>({action:'recordRefund',requestId:randomUUID(),note:'External refund confirmed',amountCOP,externalReference,confirmedExternalRefund:true});
  const a=refund(60000,'REF-A'),bb=refund(60000,'REF-B');
  const results=await Promise.allSettled([apply(a),apply(bb)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const winner=results[0]?.status==='fulfilled'?a:bb;
  await apply(winner);
  const partial=await repo.detail(w.id,owner.id,order.id);
  assert.equal(partial.recordedRefundCOP,60000);assert.equal(partial.refundableCOP,40000);
  await assert.rejects(()=>apply(refund(10000,winner.externalReference)),CheckoutConflict);
  await apply(refund(40000,'REF-C'));
  await assert.rejects(()=>apply(refund(1,'REF-D')),CheckoutConflict);
  await apply({action:'close',requestId:randomUUID(),note:'External case closed'});
  await assert.rejects(()=>apply({action:'note',requestId:randomUUID(),note:'Closed case cannot accept notes'}),CheckoutConflict);
  const final=await apply({action:'reopen',requestId:randomUUID(),note:'Follow-up case reopened'});
  assert.equal(final.caseStatus,'OPEN');assert.equal(final.recordedRefundCOP,100000);assert.equal(final.entitlementRevoked,false);
  assert.equal(await prisma.classPackageEntitlement.count({where:{workspaceId:w.id,revokedAt:null}}),1);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:ids}}});
  await prisma.user.deleteMany({where:{id:{in:[owner.id,student.id,other.id]}}});
  await prisma.$disconnect();
 }
});
