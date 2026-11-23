import {prisma} from '../../../lib/prisma.js';
import type {SessionRescheduleRepository} from '../application/ports.js';
import type {ReschedulePlan} from '../domain/reschedule.js';
import {withinWeeklyAvailability} from '../domain/weekly-availability.js';
import {holidayConflict} from '../domain/public-holidays.js';
import {SessionRescheduleConflict,SessionRescheduleMissing} from '../application/reschedule-use-case.js';
import {notifyBookedStudents} from '../../notifications/infrastructure/session-notice-publisher.js';

export class PrismaSessionRescheduleRepository implements SessionRescheduleRepository {
  async belongsToTeacher(workspaceId:string,userId:string,sessionId:string){
    return Boolean(await prisma.classSession.findFirst({
      where:{id:sessionId,workspaceId,teacher:{userId,workspaceId}},select:{id:true},
    }));
  }

  async reschedule(workspaceId:string,sessionId:string,actorUserId:string,plan:ReschedulePlan){
    return prisma.$transaction(async tx=>{
      // The booking lock prevents a concurrent student seat allocation during rescheduling.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+sessionId}))::text AS lock_acquired`;
      const session=await tx.classSession.findFirst({
        where:{id:sessionId,workspaceId,status:'CONFIRMED'},
        select:{id:true,title:true,teacherProfileId:true,roomId:true,startsAt:true,endsAt:true,status:true},
      });
      if(!session)throw new SessionRescheduleMissing();
      if(session.startsAt<=new Date())throw new SessionRescheduleConflict('A class that already started cannot be moved');
      if(!session.teacherProfileId)throw new SessionRescheduleConflict('Assign a teacher before rescheduling');
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:teacher:'+session.teacherProfileId}))::text AS lock_acquired`;
      if(session.roomId){
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:room:'+session.roomId}))::text AS lock_acquired`;
        const room=await tx.teachingRoom.findFirst({
          where:{workspaceId,id:session.roomId,active:true,campus:{workspaceId,active:true}},
          select:{capacity:true},
        });
        if(!room)throw new SessionRescheduleConflict('Physical room is unavailable');
        const conflict=await tx.classSession.findFirst({
          where:{
            workspaceId,roomId:session.roomId,id:{not:sessionId},status:'CONFIRMED',
            startsAt:{lt:plan.endsAt},endsAt:{gt:plan.startsAt},
          },select:{id:true},
        });
        if(conflict)throw new SessionRescheduleConflict('Physical room is already booked at the requested time');
      }
      const academy=await tx.workspace.findUnique({where:{id:workspaceId},select:{timezone:true,holidayCountry:true,avoidPublicHolidays:true}});
      const regularHours=await tx.weeklyAvailability.findMany({
        where:{workspaceId,teacherProfileId:session.teacherProfileId},
        select:{dayOfWeek:true,startMinute:true,endMinute:true},
      });
      if(!academy||!withinWeeklyAvailability(regularHours,plan.startsAt,plan.endsAt,academy.timezone))
        throw new SessionRescheduleConflict('Requested time is outside the teacher\'s regular availability');
      const holiday=holidayConflict(academy,plan.startsAt,plan.endsAt);
      if(holiday)throw new SessionRescheduleConflict('Requested date is a national holiday: '+holiday.name+' ('+holiday.date+')');
      const blocked=await tx.teacherTimeOff.findFirst({
        where:{
          workspaceId,teacherProfileId:session.teacherProfileId,
          startsAt:{lt:plan.endsAt},endsAt:{gt:plan.startsAt},
        },
        select:{id:true},
      });
      if(blocked)throw new SessionRescheduleConflict('Teacher is unavailable during this period');
      const overlapping=await tx.classSession.findFirst({
        where:{
          workspaceId,teacherProfileId:session.teacherProfileId,id:{not:sessionId},
          status:'CONFIRMED',startsAt:{lt:plan.endsAt},endsAt:{gt:plan.startsAt},
        },select:{id:true},
      });
      if(overlapping)throw new SessionRescheduleConflict('Teacher already has a class in the requested slot');
      const result=await tx.classSession.updateMany({
        where:{
          id:sessionId,workspaceId,status:'CONFIRMED',
          startsAt:session.startsAt,endsAt:session.endsAt,
        },
        data:{startsAt:plan.startsAt,endsAt:plan.endsAt},
      });
      if(result.count!==1)throw new SessionRescheduleConflict();
      const affectedBookings=await tx.classBooking.count({
        where:{sessionId,workspaceId,status:'BOOKED'},
      });
      const change=await tx.sessionChange.create({
        data:{
          sessionId,actorUserId,reason:plan.reason,
          oldStartsAt:session.startsAt,oldEndsAt:session.endsAt,
          newStartsAt:plan.startsAt,newEndsAt:plan.endsAt,
        },
      });
      const inAppNotificationsCreated=await notifyBookedStudents(tx,{
        workspaceId,sessionId,sessionTitle:session.title,
        kind:'SESSION_RESCHEDULED',eventKey:'rescheduled:'+change.id,
      });
      return {
        id:sessionId,startsAt:plan.startsAt,endsAt:plan.endsAt,
        affectedBookings,inAppNotificationsCreated,
        manualNotificationRequired:affectedBookings>0, // External email/WhatsApp is not connected.
        reason:plan.reason,
      };
    });
  }
}
