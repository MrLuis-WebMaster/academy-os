import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {PrismaPaymentEventInbox} from '../modules/commerce/infrastructure/prisma-payment-event-inbox.js';
import {CheckoutConflict,CheckoutUnavailable,type CheckoutConfig} from '../modules/commerce/domain/checkout.js';
import type {SignedPaymentEvent} from '../modules/commerce/application/payment-event-inbox.js';
test('PostgreSQL: duplicate webhook inserts once, leases are exclusive, and failed events can be retried only by own managers',async()=>{
 const nonce=randomUUID().slice(0,12);
 const [owner,outsider]=await Promise.all([
  prisma.user.create({data:{name:'Owner',email:'inbox-owner-'+nonce+'@example.invalid',emailVerified:true}}),
  prisma.user.create({data:{name:'Outsider',email:'inbox-other-'+nonce+'@example.invalid',emailVerified:true}}),
 ]);
 const ids:string[]=[];
 try{
  const a=await prisma.workspace.create({data:{name:'A',slug:'inbox-a-'+nonce,type:'ACADEMY',members:{create:{userId:owner.id,role:'OWNER'}}}});ids.push(a.id);
  const b=await prisma.workspace.create({data:{name:'B',slug:'inbox-b-'+nonce,type:'ACADEMY',members:{create:{userId:outsider.id,role:'OWNER'}}}});ids.push(b.id);
  const config:CheckoutConfig={workspaceId:a.id,environment:'test',merchantKeyHash:'merchant-'+nonce,issuerId:null};
  const event:SignedPaymentEvent={eventKey:'digest-'+nonce,transactionId:'tx-'+nonce,amountInCents:100000,signedStatus:'APPROVED'};
  const inbox=new PrismaPaymentEventInbox();
  await Promise.all([inbox.enqueue(config,event),inbox.enqueue(config,event)]);
  const rows=await inbox.list(a.id,owner.id,null);assert.equal(rows.length,1);
  await assert.rejects(()=>inbox.list(a.id,outsider.id,null),CheckoutUnavailable);
  await assert.rejects(()=>inbox.list(b.id,outsider.id,rows[0]!.id),CheckoutUnavailable);
  const now=new Date(Date.now()+1000);
  const claimed=await Promise.all([inbox.claim(config,now),inbox.claim(config,now)]);
  assert.equal(claimed.filter(Boolean).length,1);
  const job=claimed.find(x=>x!==null)!;
  assert.equal(await inbox.claim({...config,workspaceId:b.id},now),null);
  assert.equal(await inbox.claim({...config,merchantKeyHash:'wrong'},now),null);
  await inbox.finish({...job,lease:'wrong'}, {state:'FAILED',resolution:null,error:'VERIFICATION_FAILED'},now);
  assert.equal((await inbox.list(a.id,owner.id,null))[0]?.state,'QUEUED');
  await inbox.finish(job,{state:'FAILED',resolution:null,error:'VERIFICATION_FAILED'},now);
  await assert.rejects(()=>inbox.retry(a.id,outsider.id,job.id),CheckoutUnavailable);
  await assert.rejects(()=>inbox.retry(b.id,outsider.id,job.id),CheckoutConflict);
  await inbox.retry(a.id,owner.id,job.id);
  const retry=await inbox.claim(config,new Date(Date.now()+1000));assert.ok(retry);
  assert.equal(retry.attempts,0);
  await inbox.finish(retry,{state:'DONE',resolution:'TEST_APPROVED',error:null},new Date());
  await inbox.enqueue(config,event);
  assert.equal((await inbox.list(a.id,owner.id,null))[0]?.state,'DONE');
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:ids}}});
  await prisma.user.deleteMany({where:{id:{in:[owner.id,outsider.id]}}});
  await prisma.$disconnect();
 }
});
