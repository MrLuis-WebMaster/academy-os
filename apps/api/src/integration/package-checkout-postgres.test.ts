import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {PrismaPackageOrderRepository} from '../modules/commerce/infrastructure/prisma-package-order-repository.js';
import {PrismaPackageCheckoutRepository} from '../modules/commerce/infrastructure/prisma-package-checkout-repository.js';
import {CheckoutUnavailable,type CheckoutConfig,type VerifiedTransaction} from '../modules/commerce/domain/checkout.js';
import {OrderConflict} from '../modules/commerce/domain/package-order.js';
test('PostgreSQL: sandbox cannot issue credits; verified live fixture issues once and flags void',async()=>{
 const nonce=randomUUID().slice(0,12);
 const [owner,student]=await Promise.all([
  prisma.user.create({data:{name:'Owner',email:'checkout-owner-'+nonce+'@example.invalid',emailVerified:true}}),
  prisma.user.create({data:{name:'Student',email:'checkout-student-'+nonce+'@example.invalid',emailVerified:true}}),
 ]);
 const ids:string[]=[];
 try{
  const w=await prisma.workspace.create({data:{name:'Pilot',slug:'checkout-'+nonce,type:'ACADEMY',members:{create:[{userId:owner.id,role:'OWNER'},{userId:student.id,role:'STUDENT'}]}}});ids.push(w.id);
  const other=await prisma.workspace.create({data:{name:'Other',slug:'checkout-other-'+nonce,type:'ACADEMY'}});ids.push(other.id);
  const plan=await prisma.classPackage.create({data:{workspaceId:w.id,title:'Four classes',sessionCredits:4,priceCOP:100000,validDays:30}});
  const orders=new PrismaPackageOrderRepository(),checkout=new PrismaPackageCheckoutRepository();
  const input=()=>({packageId:plan.id,requestId:randomUUID(),expectedPriceCOP:100000});
  const create=()=>orders.create(w.id,student.id,input());
  const sandbox:CheckoutConfig={workspaceId:w.id,environment:'test',merchantKeyHash:'fixture-test',issuerId:null};
  const order=await create();
  await assert.rejects(()=>checkout.create(other.id,student.id,order.id,sandbox,randomUUID(),new Date(Date.now()+1800000)),CheckoutUnavailable);
  const started=await checkout.create(w.id,student.id,order.id,sandbox,'AO-'+randomUUID(),new Date(Date.now()+1800000));
  const testPayment:VerifiedTransaction={id:'test-'+nonce,reference:started.reference,amountInCents:10000000,currency:'COP',status:'APPROVED'};
  assert.equal((await checkout.apply(sandbox,testPayment)).resolution,'TEST_APPROVED');
  assert.equal(await prisma.classPackageEntitlement.count({where:{workspaceId:w.id}}),0);
  await assert.rejects(()=>orders.review(w.id,owner.id,order.id,{action:'fulfill',paymentReference:'TEST',amountCOP:100000,note:'invalid manual fulfillment',confirmedExternalPayment:true}),OrderConflict);
  await orders.cancel(w.id,student.id,order.id);
  const live:CheckoutConfig={...sandbox,environment:'prod',merchantKeyHash:'fixture-live',issuerId:owner.id};
  const liveOrder=await create();
  const record=await checkout.create(w.id,student.id,liveOrder.id,live,'AO-'+randomUUID(),new Date(Date.now()+1800000));
  const payment:VerifiedTransaction={...testPayment,id:'live-'+nonce,reference:record.reference};
  assert.equal((await checkout.apply({...live,workspaceId:other.id},payment)).handled,false);
  const results=await Promise.all([checkout.apply(live,payment),checkout.apply(live,payment)]);
  assert.ok(results.every(x=>x.resolution==='FULFILLED'));
  assert.equal(await prisma.classPackageEntitlement.count({where:{workspaceId:w.id}}),1);
  assert.equal((await orders.mine(w.id,student.id)).find(x=>x.id===liveOrder.id)?.status,'FULFILLED');
  assert.equal((await checkout.apply(live,{...payment,status:'VOIDED'})).resolution,'REVIEW_REQUIRED');
  assert.equal((await checkout.apply(live,payment)).resolution,'REVIEW_REQUIRED');
  assert.equal(await prisma.classPackageEntitlement.count({where:{workspaceId:w.id}}),1);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:ids}}});
  await prisma.user.deleteMany({where:{id:{in:[owner.id,student.id]}}});
  await prisma.$disconnect();
 }
});
