import {prisma} from '../../../lib/prisma.js';
import {
  REMINDER_WINDOWS,reminderDueWindow,reminderEventKey,reminderNotice,
} from '../domain/reminder-policy.js';
import type {ReminderDeliveryRepository} from '../application/reminder-ports.js';

const BATCH_SIZE=100;
/** Deterministic, idempotent, one-time in-app reminders. External provider delivery
 * is intentionally not implemented and requires a separate durable outbox/consent.
 */
export class PrismaReminderDelivery implements ReminderDeliveryRepository {
  async deliverDue(now:Date){
    let visitedSessions=0,createdNotifications=0;
    for(const window of REMINDER_WINDOWS){
      const range=reminderDueWindow(now,window.minutes);
      let cursor:string|undefined;
      while(true){
        const batch=await prisma.classSession.findMany({
          where:{
            status:'CONFIRMED',courseId:{not:null},
            startsAt:{gte:range.from,lte:range.through},
          },
          select:{id:true},orderBy:{id:'asc'},take:BATCH_SIZE,
          ...(cursor?{cursor:{id:cursor},skip:1}:{}),
        });
        if(!batch.length)break;
        for(const candidate of batch){
          const created=await prisma.$transaction(async tx=>{
            // Shared lock with reservation/cancellation and moving sessions.
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+candidate.id}))::text AS lock_acquired`;
            const session=await tx.classSession.findFirst({
              where:{
                id:candidate.id,status:'CONFIRMED',courseId:{not:null},
                startsAt:{gte:range.from,lte:range.through},
              },
              select:{
                id:true,workspaceId:true,courseId:true,title:true,startsAt:true,
                workspace:{select:{timezone:true}},
              },
            });
            if(!session?.courseId)return 0;
            const booked=await tx.classBooking.findMany({
              where:{workspaceId:session.workspaceId,sessionId:session.id,status:'BOOKED'},
              select:{userId:true},
            });
            const userIds=[...new Set(booked.map(b=>b.userId))];
            if(!userIds.length)return 0;
            const [prefs,members,enrollments]=await Promise.all([
              tx.classReminderPreference.findMany({
                where:{workspaceId:session.workspaceId,userId:{in:userIds},[window.field]:true},
                select:{userId:true},
              }),
              tx.workspaceMember.findMany({
                where:{workspaceId:session.workspaceId,userId:{in:userIds},role:'STUDENT'},
                select:{userId:true},
              }),
              tx.enrollment.findMany({
                where:{userId:{in:userIds},courseId:session.courseId,course:{workspaceId:session.workspaceId}},
                select:{userId:true},
              }),
            ]);
            const studentIds=new Set(members.map(m=>m.userId));
            const enrolledIds=new Set(enrollments.map(e=>e.userId));
            const recipients=prefs.map(p=>p.userId).filter(id=>studentIds.has(id)&&enrolledIds.has(id));
            if(!recipients.length)return 0;
            const notice=reminderNotice(session.title,session.startsAt,session.workspace.timezone,window.key);
            const eventKey=reminderEventKey(session.id,session.startsAt,window.key);
            const inserted=await tx.notification.createMany({
              data:recipients.map(userId=>({
                workspaceId:session.workspaceId,userId,sessionId:session.id,
                eventKey,kind:'CLASS_REMINDER',title:notice.title,body:notice.body,
              })),
              skipDuplicates:true,
            });
            return inserted.count;
          });
          visitedSessions++;
          createdNotifications+=created;
        }
        cursor=batch[batch.length-1]!.id;
        if(batch.length<BATCH_SIZE)break;
      }
    }
    return {visitedSessions,createdNotifications};
  }
}
