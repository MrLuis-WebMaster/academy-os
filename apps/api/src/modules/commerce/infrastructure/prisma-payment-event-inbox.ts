import {randomUUID} from 'node:crypto';
import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import {CheckoutUnavailable,CheckoutConflict,type CheckoutConfig} from '../domain/checkout.js';
import {eventRetryDelay,MAX_EVENT_ATTEMPTS,type PaymentEventInbox,type SignedPaymentEvent,type PaymentEventJob,type EventOutcome} from '../application/payment-event-inbox.js';
const view={id:true,environment:true,transactionId:true,signedStatus:true,state:true,attempts:true,resolution:true,lastErrorCode:true,createdAt:true,processedAt:true,nextAttemptAt:true} as const;
async function authorize(tx:Prisma.TransactionClient,w:string,u:string){
 if(!await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:u,role:{in:['OWNER','ADMIN']}},select:{id:true}}))throw new CheckoutUnavailable('Payment events not available');
}
export class PrismaPaymentEventInbox implements PaymentEventInbox{
 async enqueue(config:CheckoutConfig,event:SignedPaymentEvent){
  await prisma.$transaction(async tx=>{
   if(config.workspaceConfigured){
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:merchant:'+config.workspaceId}))::text`;
    if(!await tx.wompiMerchant.findFirst({where:{workspaceId:config.workspaceId,publicKeyHash:config.merchantKeyHash},select:{workspaceId:true}}))throw new CheckoutConflict('Merchant configuration changed');
   }
   await tx.paymentEventInbox.createMany({data:[{workspaceId:config.workspaceId,environment:config.environment,merchantKeyHash:config.merchantKeyHash,eventKey:event.eventKey,transactionId:event.transactionId,amountInCents:BigInt(event.amountInCents),signedStatus:event.signedStatus}],skipDuplicates:true});
  });
 }
 async claim(config:CheckoutConfig,now:Date){
  const lease=randomUUID(),until=new Date(now.getTime()+120_000);
  return prisma.$transaction(async tx=>{
   const rows=await tx.$queryRaw<Array<Omit<PaymentEventJob,'amountInCents'>&{amountInCents:bigint}>>`
    WITH candidate AS (
     SELECT id FROM "PaymentEventInbox"
     WHERE "workspaceId"=${config.workspaceId} AND environment=${config.environment}
     AND "merchantKeyHash"=${config.merchantKeyHash} AND state='QUEUED'
     AND attempts<${MAX_EVENT_ATTEMPTS} AND "nextAttemptAt"<=${now}
     AND ("leaseUntil" IS NULL OR "leaseUntil"<${now})
     ORDER BY "nextAttemptAt",id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE "PaymentEventInbox" e SET "leaseToken"=${lease},"leaseUntil"=${until}
    FROM candidate WHERE e.id=candidate.id
    RETURNING e.id,e."eventKey",e."transactionId",e."amountInCents",e."signedStatus",e."leaseToken" AS lease,e.attempts
   `;
   const row=rows[0];return row?{...row,amountInCents:Number(row.amountInCents)}:null;
  });
 }
 async finish(job:PaymentEventJob,outcome:EventOutcome,now:Date){
  await prisma.paymentEventInbox.updateMany({where:{id:job.id,leaseToken:job.lease,state:'QUEUED'},data:{
   state:outcome.state,resolution:outcome.resolution,lastErrorCode:outcome.error,leaseToken:null,leaseUntil:null,
   attempts:{increment:1},processedAt:outcome.state==='QUEUED'?null:now,
   nextAttemptAt:new Date(now.getTime()+eventRetryDelay(job.attempts)),
  }});
 }
 async list(w:string,u:string,after:string|null){
  return prisma.$transaction(async tx=>{
   await authorize(tx,w,u);
   const cursor=after?await tx.paymentEventInbox.findFirst({where:{workspaceId:w,id:after},select:{id:true,createdAt:true}}):null;
   if(after&&!cursor)throw new CheckoutUnavailable('Event cursor not available');
   return tx.paymentEventInbox.findMany({where:{workspaceId:w,...(cursor?{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,id:{lt:cursor.id}}]}:{})},select:view,orderBy:[{createdAt:'desc'},{id:'desc'}],take:50});
  });
 }
 async retry(w:string,u:string,id:string){
  await prisma.$transaction(async tx=>{
   await authorize(tx,w,u);
   const changed=await tx.paymentEventInbox.updateMany({where:{id,workspaceId:w,state:'FAILED'},data:{state:'QUEUED',attempts:0,nextAttemptAt:new Date(),processedAt:null,lastErrorCode:null,leaseToken:null,leaseUntil:null}});
   if(changed.count!==1)throw new CheckoutConflict('Only failed events can be retried');
  });
 }
}
