import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {addBillingMonths,billingPeriod,priceCatalog,parseBillingRequest,parseBillingReview} from '../modules/saas/domain/billing.js';
import {effectivePlan,SaasDenied,SaasInvalid} from '../modules/saas/domain/plan.js';
import {PrismaBillingRepository} from '../modules/saas/infrastructure/prisma-billing-repository.js';
import {PrismaSaasRepository} from '../modules/saas/infrastructure/prisma-saas-repository.js';
test('billing month boundaries clamp without losing UTC time',()=>{
 assert.equal(addBillingMonths(new Date('2028-01-31T12:15:00Z'),1).toISOString(),'2028-02-29T12:15:00.000Z');
 assert.equal(addBillingMonths(new Date('2028-02-29T12:15:00Z'),12).toISOString(),'2029-02-28T12:15:00.000Z');
 const now=new Date('2027-01-01T00:00:00Z'),end=new Date('2027-02-01T00:00:00Z');
 assert.equal(billingPeriod({plan:'PRO',validUntil:end},'PRO','MONTHLY',now).start.toISOString(),end.toISOString());
 assert.throws(()=>billingPeriod({plan:'PRO',validUntil:end},'ACADEMY','MONTHLY',now),SaasInvalid);
 assert.equal(effectivePlan({plan:'PRO',validUntil:end},end),'STARTER');
});
test('catalog only exposes configured integer prices and reviews require explicit confirmation',()=>{
 assert.deepEqual(priceCatalog({PRO_MONTHLY:'50000',PRO_YEARLY:'-1',ACADEMY_MONTHLY:'2.5',ACADEMY_YEARLY:'999999999'}),[{plan:'PRO',interval:'MONTHLY',amountCOP:50000}]);
 assert.throws(()=>parseBillingRequest({plan:'STARTER',interval:'MONTHLY',expectedAmountCOP:50000,requestId:randomUUID()}),SaasInvalid);
 const raw={action:'confirm',amountCOP:50000,paymentReference:'bank-123',note:'External payment confirmed'};
 assert.throws(()=>parseBillingReview(raw),SaasInvalid);
 assert.deepEqual(parseBillingReview({...raw,confirmedExternalPayment:true}),{...raw,paymentReference:'BANK-123'});
});
test('PostgreSQL: SaaS periods are separate, idempotent, scoped and protected',async()=>{
 const nonce=randomUUID().slice(0,12);
 const users=await Promise.all(['owner','operator','other'].map(name=>prisma.user.create({data:{name,email:'billing-'+name+'-'+nonce+'@example.invalid',emailVerified:true}})));
 const [owner,operator,other]=users;
 assert.ok(owner&&operator&&other);
 const ids:string[]=[];
 try{
  const a=await prisma.workspace.create({data:{slug:'billing-a-'+nonce,name:'Billing A',type:'ACADEMY',members:{create:{role:'OWNER',userId:owner.id}}}});ids.push(a.id);
  const b=await prisma.workspace.create({data:{slug:'billing-b-'+nonce,name:'Billing B',type:'SOLO',members:{create:{role:'OWNER',userId:other.id}}}});ids.push(b.id);
  const repo=new PrismaBillingRepository(new Set([operator.id])),plans=new PrismaSaasRepository(new Set([operator.id]));
  const prices=priceCatalog({PRO_MONTHLY:'50000',ACADEMY_MONTHLY:'100000'});
  const input=()=>parseBillingRequest({plan:'PRO',interval:'MONTHLY',expectedAmountCOP:50000,requestId:randomUUID()});
  await assert.rejects(()=>repo.create(a.id,other.id,input(),prices),SaasDenied);
  await assert.rejects(()=>repo.create(a.id,owner.id,{...input(),expectedAmountCOP:1},prices),SaasInvalid);
  const request=input();
  const created=await Promise.all([repo.create(a.id,owner.id,request,prices),repo.create(a.id,owner.id,request,prices)]);
  assert.equal(created[0]?.id,created[1]?.id);
  const first=created[0]!;
  await assert.rejects(()=>repo.create(a.id,owner.id,input(),prices),SaasInvalid);
  const review=parseBillingReview({action:'confirm',amountCOP:50000,paymentReference:'BANK-'+nonce,note:'External payment confirmed',confirmedExternalPayment:true});
  await assert.rejects(()=>repo.review(a.id,owner.id,first.id,review),SaasDenied);
  await assert.rejects(()=>repo.list(a.id,other.id,null,false),SaasDenied);
  const paid=await Promise.all([repo.review(a.id,operator.id,first.id,review),repo.review(a.id,operator.id,first.id,review)]);
  assert.equal(paid[0]?.status,'PAID');assert.equal(paid[0]?.periodEnd?.toISOString(),paid[1]?.periodEnd?.toISOString());
  assert.equal(await prisma.saasPlanChange.count({where:{workspaceId:a.id}}),1);
  await assert.rejects(()=>plans.assign(operator.id,a.id,{plan:'STARTER',validUntil:null,reason:'Attempt premature downgrade'}),SaasInvalid);
  const next=await repo.create(a.id,owner.id,input(),prices);
  await assert.rejects(()=>repo.review(a.id,operator.id,next.id,review),SaasInvalid);
  const renewal=await repo.review(a.id,operator.id,next.id,{...review,paymentReference:'BANK-RENEW-'+nonce} as typeof review);
  assert.equal(renewal.periodStart?.toISOString(),paid[0]?.periodEnd?.toISOString());
  assert.equal(renewal.periodEnd?.toISOString(),addBillingMonths(paid[0]!.periodEnd!,1).toISOString());
  const foreign=await repo.create(b.id,other.id,input(),prices);
  await assert.rejects(()=>repo.review(b.id,operator.id,foreign.id,review),SaasInvalid);
  await repo.cancel(b.id,other.id,foreign.id);
  assert.equal(await prisma.saasSubscription.count({where:{workspaceId:b.id}}),0);
  assert.equal(await prisma.packageOrder.count({where:{workspaceId:a.id}}),0);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:ids}}});
  await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
  await prisma.$disconnect();
 }
});
