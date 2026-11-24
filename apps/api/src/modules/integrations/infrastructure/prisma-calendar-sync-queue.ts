import {randomUUID} from 'node:crypto';
import {prisma} from '../../../lib/prisma.js';
import type {CalendarSyncJob,CalendarSyncQueue} from '../application/calendar-sync-worker.js';

const MAX_ATTEMPTS=5;
export class PrismaCalendarSyncQueue implements CalendarSyncQueue{
 async claim(now:Date):Promise<CalendarSyncJob|null>{
  const leaseToken=randomUUID(),leaseUntil=new Date(now.getTime()+120_000);
  // Claim only explicitly enabled links; locking prevents simultaneous worker claims.
  const rows=await prisma.$queryRaw<CalendarSyncJob[]>`
   WITH candidate AS (
    SELECT l."id",c."workspaceId",c."userId"
    FROM "CalendarSyncLink" l JOIN "ExternalConnection" c ON c."id"=l."connectionId"
    JOIN "ClassSession" s ON s."id"=l."sessionId" AND s."workspaceId"=c."workspaceId"
    WHERE l."revision">l."deliveredRevision" AND l."attempts"<${MAX_ATTEMPTS}
     AND l."nextAttemptAt"<=${now} AND (l."leaseUntil" IS NULL OR l."leaseUntil"<${now})
     AND c."provider"='GOOGLE_CALENDAR' AND c."encryptedCredentials" IS NOT NULL
     AND c."connectedAt"=l."connectionGeneration"
    ORDER BY l."nextAttemptAt",l."id" LIMIT 1 FOR UPDATE OF l SKIP LOCKED
   )
   UPDATE "CalendarSyncLink" l SET "leaseToken"=${leaseToken},"leaseUntil"=${leaseUntil}
   FROM candidate WHERE l."id"=candidate."id"
   RETURNING l."id",l."leaseToken",l."revision",l."attempts",l."sessionId",
    l."connectionId",l."connectionGeneration",candidate."workspaceId",candidate."userId"
  `;
  return rows[0]??null;
 }
 async finish(job:CalendarSyncJob,outcome:{ok:boolean;permanent?:boolean;code?:string},now:Date){
  // A later class edit increments revision and must not be marked delivered by this job.
  const attempts=outcome.ok?0:outcome.permanent?MAX_ATTEMPTS:job.attempts+1;
  const nextAttemptAt=new Date(now.getTime()+Math.min(60*60_000,60_000*2**Math.max(0,attempts-1)));
  const applied=await prisma.calendarSyncLink.updateMany({where:{id:job.id,leaseToken:job.leaseToken,revision:job.revision},
   data:{leaseToken:null,leaseUntil:null,attempts,nextAttemptAt,lastErrorCode:outcome.ok?null:(outcome.code??'PROVIDER_UNAVAILABLE'),
    ...(outcome.ok?{deliveredRevision:job.revision}:{})}});
  if(applied.count===0){
   // If a newer revision arrived, release only our own lease and let it run promptly.
   await prisma.calendarSyncLink.updateMany({where:{id:job.id,leaseToken:job.leaseToken},
    data:{leaseToken:null,leaseUntil:null,nextAttemptAt:now}});
  }
 }
}
