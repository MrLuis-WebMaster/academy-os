import {randomUUID} from 'node:crypto';
import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import {EMAIL_KINDS,EMAIL_MAX_AGE_MS,EMAIL_MAX_ATTEMPTS,EmailNoticeDenied,emailRetryDelay} from '../domain/email-notice.js';
import {REMINDER_WINDOWS,reminderEventKey} from '../domain/reminder-policy.js';
import type {EmailPreferenceRepository,EmailNoticeQueue,EmailJob,EmailOutcome} from '../application/email-notice-ports.js';
async function member(tx:Prisma.TransactionClient,w:string,u:string){
 if(!await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:u,role:'STUDENT',user:{emailVerified:true}},select:{id:true}}))throw new EmailNoticeDenied('Verified student required');
}
export class PrismaEmailPreferences implements EmailPreferenceRepository{
 async read(w:string,u:string){
  return prisma.$transaction(async tx=>{await member(tx,w,u);return await tx.emailNoticePreference.findUnique({where:{workspaceId_userId:{workspaceId:w,userId:u}},select:{enabled:true}})??{enabled:false};});
 }
 async save(w:string,u:string,enabled:boolean){
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:email-pref:'+w+':'+u}))::text`;
   await member(tx,w,u);
   const prior=await tx.emailNoticePreference.findUnique({where:{workspaceId_userId:{workspaceId:w,userId:u}}});
   const enabledSince=enabled?(prior?.enabled?prior.enabledSince??new Date():new Date()):null;
   return tx.emailNoticePreference.upsert({where:{workspaceId_userId:{workspaceId:w,userId:u}},create:{workspaceId:w,userId:u,enabled,enabledSince},update:{enabled,enabledSince},select:{enabled:true}});
  });
 }
}
export class PrismaEmailNoticeQueue implements EmailNoticeQueue{
 async enqueue(now:Date){
  const cutoff=new Date(now.getTime()-EMAIL_MAX_AGE_MS);
  // Notifications are already durable and transactionally created by business flows.
  return prisma.$executeRaw`
   INSERT INTO "EmailNoticeDelivery" ("notificationId","createdAt","nextAttemptAt")
   SELECT n.id,${now},${now} FROM "Notification" n
   JOIN "EmailNoticePreference" p ON p."workspaceId"=n."workspaceId" AND p."userId"=n."userId"
   JOIN "User" u ON u.id=n."userId"
   WHERE p.enabled AND p."enabledSince"<=n."createdAt" AND u."emailVerified"
   AND n."createdAt">=${cutoff} AND n."createdAt"<=${now}
   AND n.kind IN ('COURSE_ENROLLED','BOOKING_CONFIRMED','SESSION_CANCELLED','SESSION_RESCHEDULED','CLASS_REMINDER')
   AND EXISTS (SELECT 1 FROM "WorkspaceMember" m WHERE m."workspaceId"=n."workspaceId" AND m."userId"=n."userId" AND m.role='STUDENT')
   AND NOT EXISTS (SELECT 1 FROM "EmailNoticeDelivery" d WHERE d."notificationId"=n.id)
   ORDER BY n."createdAt",n.id LIMIT 200 ON CONFLICT ("notificationId") DO NOTHING
  `;
 }
 async claim(now:Date){
  const lease=randomUUID(),until=new Date(now.getTime()+120000),cutoff=new Date(now.getTime()-EMAIL_MAX_AGE_MS);
  await prisma.emailNoticeDelivery.updateMany({where:{state:'QUEUED',notification:{createdAt:{lt:cutoff}},OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},data:{state:'SKIPPED',errorCode:'EXPIRED',finishedAt:now,leaseToken:null,leaseUntil:null}});
  const rows=await prisma.$queryRaw<EmailJob[]>`
   WITH candidate AS (
    SELECT d."notificationId" FROM "EmailNoticeDelivery" d JOIN "Notification" n ON n.id=d."notificationId"
    WHERE d.state='QUEUED' AND d.attempts<${EMAIL_MAX_ATTEMPTS} AND d."nextAttemptAt"<=${now}
    AND n."createdAt">=${cutoff} AND (d."leaseUntil" IS NULL OR d."leaseUntil"<${now})
    ORDER BY d."nextAttemptAt",d."notificationId" LIMIT 1 FOR UPDATE OF d SKIP LOCKED
   )
   UPDATE "EmailNoticeDelivery" d SET "leaseToken"=${lease},"leaseUntil"=${until}
   FROM candidate WHERE d."notificationId"=candidate."notificationId"
   RETURNING d."notificationId",d."leaseToken" AS lease,d.attempts
  `;
  return rows[0]??null;
 }
 async recipient(job:EmailJob,now:Date){
  return prisma.$transaction(async tx=>{
   const delivery=await tx.emailNoticeDelivery.findFirst({where:{notificationId:job.notificationId,state:'QUEUED',leaseToken:job.lease,leaseUntil:{gt:now}},include:{notification:{include:{user:{select:{email:true,emailVerified:true}}}}}});
   if(!delivery)return null;
   const n=delivery.notification;
   if(!n.user.emailVerified||!EMAIL_KINDS.some(k=>k===n.kind)||n.createdAt.getTime()<now.getTime()-EMAIL_MAX_AGE_MS)return null;
   const preference=await tx.emailNoticePreference.findUnique({where:{workspaceId_userId:{workspaceId:n.workspaceId,userId:n.userId}}});
   if(!preference?.enabled||!preference.enabledSince||preference.enabledSince>n.createdAt)return null;
   if(!await tx.workspaceMember.findFirst({where:{workspaceId:n.workspaceId,userId:n.userId,role:'STUDENT'},select:{id:true}}))return null;
   if(n.kind==='CLASS_REMINDER'){
    if(!n.sessionId)return null;
    const session=await tx.classSession.findFirst({where:{id:n.sessionId,workspaceId:n.workspaceId,status:'CONFIRMED',startsAt:{gt:now}},select:{id:true,startsAt:true,courseId:true}});
    if(!session?.courseId)return null;
    const window=REMINDER_WINDOWS.find(w=>reminderEventKey(session.id,session.startsAt,w.key)===n.eventKey);
    if(!window||!await tx.classReminderPreference.findFirst({where:{workspaceId:n.workspaceId,userId:n.userId,[window.field]:true},select:{id:true}}))return null;
    if(!await tx.classBooking.findFirst({where:{workspaceId:n.workspaceId,userId:n.userId,sessionId:session.id,status:'BOOKED'},select:{id:true}}))return null;
    if(!await tx.enrollment.findFirst({where:{userId:n.userId,courseId:session.courseId,course:{workspaceId:n.workspaceId}},select:{id:true}}))return null;
   }
   return n.user.email;
  });
 }
 async finish(job:EmailJob,outcome:EmailOutcome,now:Date){
  await prisma.emailNoticeDelivery.updateMany({where:{notificationId:job.notificationId,leaseToken:job.lease,state:'QUEUED'},data:{
   ...outcome,attempts:{increment:1},leaseToken:null,leaseUntil:null,nextAttemptAt:new Date(now.getTime()+emailRetryDelay(job.attempts)),finishedAt:outcome.state==='QUEUED'?null:now,
  }});
 }
}
