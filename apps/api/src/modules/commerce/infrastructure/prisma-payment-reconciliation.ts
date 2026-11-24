import {randomUUID} from 'node:crypto';
import {prisma} from '../../../lib/prisma.js';
import type {CheckoutConfig} from '../domain/checkout.js';
import {reconciliationDelay,type ReconciliationQueue,type ReconciliationJob} from '../application/payment-reconciliation.js';
export class PrismaPaymentReconciliation implements ReconciliationQueue{
 async claim(config:CheckoutConfig,now:Date){
  const lease=randomUUID();
  const until=new Date(now.getTime()+120_000);
  return prisma.$transaction(async tx=>{
   const rows=await tx.$queryRaw<ReconciliationJob[]>`
    WITH candidate AS (
      SELECT c."orderId" FROM "PackageCheckout" c JOIN "PackageOrder" o ON o.id=c."orderId"
      WHERE o."workspaceId"=${config.workspaceId} AND c."environment"=${config.environment}
      AND c."merchantKeyHash"=${config.merchantKeyHash}
      AND c."providerTransactionId" IS NOT NULL AND c."providerStatus"='PENDING'
      AND c."resolution"='WAITING' AND c."checkAttempts"<12 AND c."nextCheckAt"<=${now}
      AND (c."checkLeaseUntil" IS NULL OR c."checkLeaseUntil"<${now})
      ORDER BY c."nextCheckAt",c."orderId" LIMIT 1 FOR UPDATE OF c SKIP LOCKED
    )
    UPDATE "PackageCheckout" c SET "checkLease"=${lease},"checkLeaseUntil"=${until}
    FROM candidate WHERE c."orderId"=candidate."orderId"
    RETURNING c."orderId",c.reference,c."providerTransactionId" AS "transactionId",c."checkLease" AS lease,c."checkAttempts" AS attempts
   `;
   return rows[0]??null;
  });
 }
 async finish(job:ReconciliationJob,now:Date,error:string|null){
  await prisma.packageCheckout.updateMany({where:{orderId:job.orderId,checkLease:job.lease},data:{
   checkLease:null,checkLeaseUntil:null,
   checkAttempts:{increment:1},checkError:error,
   nextCheckAt:new Date(now.getTime()+reconciliationDelay(job.attempts,error!==null)),
  }});
 }
}
