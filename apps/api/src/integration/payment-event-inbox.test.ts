import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {WompiGateway} from '../modules/commerce/infrastructure/wompi-gateway.js';
import {CheckoutUseCases} from '../modules/commerce/application/checkout-use-cases.js';
import {ProcessPaymentEvents,eventRetryDelay,type PaymentEventInbox,type PaymentEventJob,type EventOutcome,type SignedPaymentEvent} from '../modules/commerce/application/payment-event-inbox.js';
import {InvalidPaymentEvent,type VerifiedTransaction} from '../modules/commerce/domain/checkout.js';
import type {CheckoutRepository,PaymentGateway} from '../modules/commerce/application/checkout-ports.js';
const settings={enabled:true,workspaceId:'academy',environment:'test',publicKey:'pub_test_fixture',privateKey:'prv_test_fixture',integrityKey:'test_integrity_fixture',eventsKey:'test_events_fixture',issuerId:'',webOrigin:'https://academy.example.invalid'};
const signed={id:'tx-123',reference:'untrusted-reference',amount_in_cents:100000,currency:'COP',status:'APPROVED'};
const timestamp=1780000000;
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
function raw(){return {event:'transaction.updated',environment:'test',timestamp,data:{transaction:{...signed,customer_email:'not-stored@example.invalid'}},signature:{properties:['transaction.id','transaction.status','transaction.amount_in_cents'],checksum:sha(signed.id+signed.status+signed.amount_in_cents+timestamp+settings.eventsKey)}};}
function fakeInbox(overrides:Partial<PaymentEventInbox>={}):PaymentEventInbox{
 return {enqueue:async()=>{},claim:async()=>null,finish:async()=>{},list:async()=>[],retry:async()=>{},...overrides};
}
test('signed event is persisted without provider access or unsigned reference and customer data',async()=>{
 let reads=0;
 const gateway=new WompiGateway(settings,async()=>{reads++;throw Error('offline');});
 const events:SignedPaymentEvent[]=[];
 const inbox=fakeInbox({enqueue:async(_config,event)=>{events.push(event);}});
 const repo={} as CheckoutRepository;
 const app=new CheckoutUseCases(repo,gateway,{hasAnyRole:async()=>false},undefined,inbox);
 assert.deepEqual(await app.webhook(raw()),{accepted:true});
 const replay=raw();replay.data.transaction.reference='another-unsigned-reference';
 await app.webhook(replay);
 assert.equal(reads,0);assert.equal(events.length,2);
 assert.deepEqual(events[0],events[1]);
 assert.deepEqual(Object.keys(events[0]!).sort(),['amountInCents','eventKey','signedStatus','transactionId']);
 const tampered=raw();tampered.data.transaction.amount_in_cents=1;
 await assert.rejects(()=>app.webhook(tampered),InvalidPaymentEvent);
 assert.equal(events.length,2);
});
test('worker uses authenticated provider result, detects mismatch, retries failures and exhausts attempts',async()=>{
 const jobs:PaymentEventJob[]=['good','wrong','fail','exhausted','unknown'].map(id=>({id,eventKey:id,transactionId:id,amountInCents:100000,signedStatus:'APPROVED',lease:'lease-'+id,attempts:id==='exhausted'?11:0}));
 const outcomes:Record<string,EventOutcome>={};let calls=0;
 const config=new WompiGateway(settings).config()!;
 const gateway:PaymentGateway={config:()=>config,reference:()=>'',url:()=>'',verifyEvent:async()=>null,readTransaction:async(id):Promise<VerifiedTransaction>=>{
  if(['fail','exhausted'].includes(id))throw Error('provider unavailable');
  return {id,reference:'verified-reference',amountInCents:id==='wrong'?1:100000,currency:'COP',status:'APPROVED'};
 }};
 const inbox=fakeInbox({claim:async()=>jobs.shift()??null,finish:async(job,outcome)=>{outcomes[job.id]=outcome;}});
 const processor=new ProcessPaymentEvents(inbox,{apply:async(_config,payment)=>{calls++;assert.equal(payment.reference,'verified-reference');return payment.id==='unknown'?{handled:false,resolution:'UNKNOWN_REFERENCE'}:{handled:true,resolution:'FULFILLED'};}},gateway);
 assert.deepEqual(await processor.execute(),{processed:3,failed:2});
 assert.equal(calls,2);assert.equal(outcomes.good?.state,'DONE');assert.equal(outcomes.wrong?.state,'REVIEW');assert.equal(outcomes.fail?.state,'QUEUED');assert.equal(outcomes.exhausted?.state,'FAILED');assert.equal(outcomes.unknown?.state,'IGNORED');
 assert.equal(eventRetryDelay(0),60000);assert.equal(eventRetryDelay(100),3600000);
});
test('database persistence failure propagates rather than acknowledging webhook',async()=>{
 const gateway=new WompiGateway(settings);
 const app=new CheckoutUseCases({} as CheckoutRepository,gateway,{hasAnyRole:async()=>false},undefined,fakeInbox({enqueue:async()=>{throw Error('db unavailable');}}));
 await assert.rejects(()=>app.webhook(raw()),/db unavailable/);
});
