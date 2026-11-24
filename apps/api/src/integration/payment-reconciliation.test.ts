import test from 'node:test';
import assert from 'node:assert/strict';
import {CheckoutUseCases} from '../modules/commerce/application/checkout-use-cases.js';
import {ReconcilePayments,reconciliationDelay,type ReconciliationJob} from '../modules/commerce/application/payment-reconciliation.js';
import type {CheckoutRepository,PaymentGateway} from '../modules/commerce/application/checkout-ports.js';
import {CheckoutUnavailable,CheckoutConflict,type CheckoutConfig,type CheckoutRecord,type VerifiedTransaction} from '../modules/commerce/domain/checkout.js';
const config:CheckoutConfig={workspaceId:'academy',environment:'test',merchantKeyHash:'merchant',issuerId:null};
const row:CheckoutRecord={orderId:'order',reference:'AO-reference',merchantKeyHash:'merchant',environment:'test',amountInCents:100000n,expiresAt:new Date(Date.now()+60_000),providerTransactionId:null,providerStatus:'PENDING',resolution:'WAITING'};
const payment:VerifiedTransaction={id:'tx-123',reference:row.reference,amountInCents:100000,currency:'COP',status:'APPROVED'};
function fakeGateway(read:PaymentGateway['readTransaction']):PaymentGateway{
 return {config:()=>config,reference:()=>row.reference,url:()=>'',verifyEvent:async()=>null,readTransaction:read};
}
test('student recovery uses authenticated provider result; wrong order never applies',async()=>{
 let applies=0,reads=0;
 const repo:CheckoutRepository={create:async()=>row,list:async()=>[row],target:async(w,u,id,manager)=>{
  assert.equal(manager,false);
  if(w!=='academy'||u!=='student'||id!=='order')throw new CheckoutUnavailable();
  return row;
 },apply:async()=>{applies++;return {handled:true,resolution:'TEST_APPROVED'};}};
 const app=new CheckoutUseCases(repo,fakeGateway(async id=>{reads++;return {...payment,id,reference:id==='wrong'?'other':row.reference};}),{hasAnyRole:async(_w,_u,roles)=>roles.includes('STUDENT')});
 await assert.rejects(()=>app.reconcile('academy','other','order',{transactionId:'tx-123'}),CheckoutUnavailable);
 assert.equal(reads,0);
 await assert.rejects(()=>app.reconcile('academy','student','order',{transactionId:'wrong'}),CheckoutUnavailable);
 await assert.rejects(()=>app.reconcile('academy','student','order',{transactionId:'../unsafe'}),CheckoutConflict);
 assert.equal(applies,0);
 assert.equal((await app.reconcile('academy','student','order',{transactionId:'tx-123'})).resolution,'TEST_APPROVED');
 assert.equal(applies,1);
});
test('reconciliation worker finishes claimed jobs and retries provider failures without applying mismatched reference',async()=>{
 const jobs:ReconciliationJob[]=['good','bad','failed'].map(id=>({orderId:id,reference:row.reference,transactionId:id,lease:'lease-'+id,attempts:2}));
 const outcomes:Array<{id:string;error:string|null}>=[];let applied=0;
 const worker=new ReconcilePayments({claim:async()=>jobs.shift()??null,finish:async(job,_now,error)=>{outcomes.push({id:job.orderId,error});}},
  {apply:async()=>{applied++;return {handled:true,resolution:'WAITING'};}},
  fakeGateway(async id=>{if(id==='failed')throw Error('provider unavailable');return {...payment,id,reference:id==='bad'?'wrong':row.reference};}));
 assert.deepEqual(await worker.execute(),{checked:1,failed:2});
 assert.equal(applied,1);
 assert.deepEqual(outcomes,[{id:'good',error:null},{id:'bad',error:'VERIFICATION_FAILED'},{id:'failed',error:'VERIFICATION_FAILED'}]);
 assert.equal(reconciliationDelay(0,true),60000);
 assert.equal(reconciliationDelay(100,true),3600000);
});
