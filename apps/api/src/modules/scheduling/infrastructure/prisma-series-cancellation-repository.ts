import {prisma} from '../../../lib/prisma.js';
import type {WeeklySeriesCancellationRepository} from '../application/series-cancellation-ports.js';
import {SeriesCancellationNotFound} from '../application/cancel-future-series-use-case.js';
import {notifyBookedStudents} from '../../notifications/infrastructure/session-notice-publisher.js';
import {refundSessionCredits} from '../../commerce/infrastructure/package-credits.js';

export class PrismaWeeklySeriesCancellationRepository implements WeeklySeriesCancellationRepository {
 async belongsToAssignedTeacher(workspaceId:string,userId:string,seriesId:string){
  return Boolean(await prisma.classSeries.findFirst({
   where:{id:seriesId,workspaceId,teacher:{workspaceId,userId}},select:{id:true},
  }));
 }
 async cancelFuture(workspaceId:string,seriesId:string){
  return prisma.$transaction(async tx=>{
   const series=await tx.classSeries.findFirst({
    where:{id:seriesId,workspaceId},select:{id:true,teacherProfileId:true},
   });
   if(!series)throw new SeriesCancellationNotFound();
   const now=new Date();
   const initial=await tx.classSession.findMany({
    where:{workspaceId,seriesId,status:'CONFIRMED',startsAt:{gt:now}},
    select:{id:true},orderBy:{id:'asc'},
   });
   // Same lock order as a single reschedule: booking(s) first, then teacher.
   for(const session of initial){
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+session.id}))::text AS lock_acquired`;
   }
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:teacher:'+series.teacherProfileId}))::text AS lock_acquired`;
   const latest=await tx.classSession.findMany({
    where:{workspaceId,seriesId,status:'CONFIRMED',startsAt:{gt:new Date()}},
    select:{id:true,title:true},orderBy:{id:'asc'},
   });
   let cancelledSessions=0,inAppNotificationsCreated=0;
   for(const session of latest){
    // Safeguard against a status update while acquiring locks.
    const changed=await tx.classSession.updateMany({
     where:{id:session.id,workspaceId,seriesId,status:'CONFIRMED',startsAt:{gt:new Date()}},
     data:{status:'CANCELLED'},
    });
    if(changed.count!==1)continue;
    cancelledSessions++;
    await refundSessionCredits(tx,session.id);
    inAppNotificationsCreated+=await notifyBookedStudents(tx,{
     workspaceId,sessionId:session.id,sessionTitle:session.title,
     kind:'SESSION_CANCELLED',eventKey:'cancelled:'+session.id,
    });
   }
   return {seriesId,cancelledSessions,inAppNotificationsCreated,historicalSessionsPreserved:true};
  },{timeout:15000});
 }
}
