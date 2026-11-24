import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {WompiGateway,verifyWompiSignature} from '../modules/commerce/infrastructure/wompi-gateway.js';
import {InvalidPaymentEvent,PaymentProviderUnavailable,amountInCents,type CheckoutRecord} from '../modules/commerce/domain/checkout.js';
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const settings={enabled:true,workspaceId:'pilot',environment:'test',publicKey:'pub_test_fixture',privateKey:'prv_test_fixture',integrityKey:'test_integrity_fixture',eventsKey:'test_events_fixture',issuerId:'',webOrigin:'https://academy.example.invalid'};
const timestamp=1780000000;
const tx={id:'transaction-1',reference:'AO-test',amount_in_cents:10000000,currency:'COP',status:'APPROVED'};
function event(){
 return {event:'transaction.updated',environment:'test',timestamp,data:{transaction:{...tx}},signature:{properties:['transaction.id','transaction.status','transaction.amount_in_cents'],checksum:sha(tx.id+tx.status+tx.amount_in_cents+timestamp+settings.eventsKey)}};
}
test('checkout signature includes immutable amount and expiration; secrets stay server-side',()=>{
 const gateway=new WompiGateway(settings),config=gateway.config();assert.ok(config);
 const row:CheckoutRecord={orderId:'o',reference:'AO-test',environment:'test',merchantKeyHash:config.merchantKeyHash,amountInCents:BigInt(amountInCents(100000)),expiresAt:new Date('2027-01-01T00:00:00Z'),providerStatus:'PENDING',resolution:'WAITING',providerTransactionId:null};
 const url=new URL(gateway.url(row));
 assert.equal(url.origin,'https://checkout.wompi.co');
 assert.equal(url.searchParams.get('amount-in-cents'),'10000000');
 assert.equal(url.searchParams.get('signature:integrity'),sha(row.reference+'10000000COP'+row.expiresAt.toISOString()+settings.integrityKey));
 for(const key of [settings.privateKey,settings.integrityKey,settings.eventsKey])assert.ok(!url.toString().includes(key));
 assert.equal(new WompiGateway({...settings,environment:'prod'}).config(),null);
 assert.throws(()=>amountInCents(-1));
});
test('rejects tampered event fields and wrong environment',()=>{
 assert.equal(verifyWompiSignature(event(),settings.eventsKey,'test')?.id,tx.id);
 const bad=event();bad.data.transaction.amount_in_cents=1;
 assert.throws(()=>verifyWompiSignature(bad,settings.eventsKey,'test'),InvalidPaymentEvent);
 assert.throws(()=>verifyWompiSignature(event(),settings.eventsKey,'prod'),InvalidPaymentEvent);
 const reordered=event();reordered.signature.properties.reverse();
 assert.throws(()=>verifyWompiSignature(reordered,settings.eventsKey,'test'),InvalidPaymentEvent);
});
test('uses authenticated provider read rather than unsigned reference',async()=>{
 const raw=event();raw.data.transaction.reference='AO-attacker';
 let calls=0;
 const fetcher:typeof fetch=async(input,options)=>{
  calls++;assert.equal(input,'https://sandbox.wompi.co/v1/transactions/transaction-1');
  assert.equal(new Headers(options?.headers).get('Authorization'),'Bearer '+settings.privateKey);
  return new Response(JSON.stringify({data:tx}),{status:200});
 };
 const gateway=new WompiGateway(settings,fetcher);
 assert.equal((await gateway.verifyEvent(raw))?.reference,tx.reference);
 assert.equal(calls,1);
 const bad=event();bad.signature.checksum='0'.repeat(64);
 await assert.rejects(()=>gateway.verifyEvent(bad),InvalidPaymentEvent);
 assert.equal(calls,1);
 const failed=new WompiGateway(settings,async()=>new Response('',{status:503}));
 await assert.rejects(()=>failed.verifyEvent(event()),PaymentProviderUnavailable);
});
