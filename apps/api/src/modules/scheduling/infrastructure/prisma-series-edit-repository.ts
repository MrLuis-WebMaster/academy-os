import {prisma} from '../../../lib/prisma.js';
import {parseLessonDraft} from '../domain/lesson.js';
import {planEditedFutureSeries} from '../domain/series-edit.js';
import {withinWeeklyAvailability} from '../domain/weekly-availability.js';
import {holidayConflict} from '../domain/public-holidays.js';
import {intervalsOverlap} from '../domain/time-off.js';
import {notifyBookedStudents} from '../../notifications/infrastructure/session-notice-publisher.js';
import type {SeriesEditRepository} from '../application/edit-future-series.js';
import type {FutureSeriesEdit} from '../domain/series-edit.js';
import {
  SeriesEditConflict,SeriesEditDenied,SeriesEditNotFound,
} from '../application/edit-future-series.js';

export class PrismaSeriesEditRepository implements SeriesEditRepository {
  async editFuture(workspaceId:string,actorId:string,seriesId:string,input:FutureSeriesEdit){
    return prisma.$transaction(async tx=>{
      const series=await tx.classSeries.findFirst({
        where:{workspaceId,id:seriesId},
        select:{id:true,teacherProfileId:true,timezone:true,teacher:{select:{userId:true}}},
      });
      if(!series)throw new SeriesEditNotFound();
      // First lock all bookings in deterministic order, then the teacher lock.
      // This mirrors rescheduling and mass cancellation and serializes seat changes.
      const initial=await tx.classSession.findMany({
        where:{workspaceId,seriesId,status:'CONFIRMED',startsAt:{gt:new Date()}},
        select:{id:true},orderBy:{id:'asc'},
      });
      if(!initial.length)throw new SeriesEditConflict('No confirmed future classes remain to edit');
      for(const item of initial){
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+item.id}))::text AS lock_acquired`;
      }
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:teacher:'+series.teacherProfileId}))::text AS lock_acquired`;
      const [membership,academy,sessions]=await Promise.all([
        tx.workspaceMember.findMany({
          where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
          select:{role:true},
        }),
        tx.workspace.findFirst({where:{id:workspaceId},select:{timezone:true,holidayCountry:true,avoidPublicHolidays:true}}),
        tx.classSession.findMany({
          where:{workspaceId,seriesId,status:'CONFIRMED',startsAt:{gt:new Date()}},
          select:{
            id:true,title:true,teacherProfileId:true,courseId:true,startsAt:true,endsAt:true,
            seriesIndex:true,mode:true,capacity:true,location:true,meetingUrl:true,
          },
          orderBy:{id:'asc'},
        }),
      ]);
      if(!membership.length)throw new SeriesEditDenied();
      const manager=membership.some(member=>member.role==='OWNER'||member.role==='ADMIN');
      if(!manager&&series.teacher.userId!==actorId)throw new SeriesEditDenied();
      if(!academy)throw new SeriesEditNotFound();
      if(sessions.length!==initial.length||sessions.some((item,i)=>item.id!==initial[i]?.id)){
        throw new SeriesEditConflict('The series changed; refresh before editing');
      }
      if(sessions.some(s=>s.seriesIndex===null||s.teacherProfileId!==series.teacherProfileId)){
        throw new SeriesEditConflict('Series contains invalid occurrences');
      }
      const indexed=sessions.map(s=>({
        id:s.id,seriesIndex:s.seriesIndex!,startsAt:s.startsAt,endsAt:s.endsAt,
      }));
      const byIndex=[...indexed].sort((a,b)=>a.seriesIndex-b.seriesIndex);
      const moved=Boolean(input.startsAt&&input.endsAt);
      const planned=moved
        ?planEditedFutureSeries(indexed,{
          startsAt:new Date(input.startsAt!),endsAt:new Date(input.endsAt!),
        },academy.timezone)
        :new Map(indexed.map(s=>[s.id,{startsAt:s.startsAt,endsAt:s.endsAt}]));

      const next=sessions.map(session=>{
        const window=planned.get(session.id)!;
        // Reuse the same domain rules as individual and newly recurring lessons.
        const updated=parseLessonDraft({
          title:input.title??session.title,
          mode:input.mode??session.mode,
          capacity:input.capacity??session.capacity,
          teacherProfileId:series.teacherProfileId,
          courseId:session.courseId??undefined,
          location:input.location===undefined?session.location??undefined:input.location??undefined,
          meetingUrl:input.meetingUrl===undefined?session.meetingUrl??undefined:input.meetingUrl??undefined,
          startsAt:window.startsAt.toISOString(),
          endsAt:window.endsAt.toISOString(),
        });
        return {session,window,updated};
      });

      // Reject reducing capacity below confirmed seats even if no time changes.
      for(const row of next){
        const occupied=await tx.classBooking.count({
          where:{workspaceId,sessionId:row.session.id,status:'BOOKED'},
        });
        if(occupied>row.updated.capacity){
          throw new SeriesEditConflict('Cannot reduce capacity below existing reservations');
        }
      }

      if(moved){
        const regular=await tx.weeklyAvailability.findMany({
          where:{workspaceId,teacherProfileId:series.teacherProfileId},
          select:{dayOfWeek:true,startMinute:true,endMinute:true},
        });
        const earliest=new Date(Math.min(...next.map(x=>x.window.startsAt.getTime())));
        const latest=new Date(Math.max(...next.map(x=>x.window.endsAt.getTime())));
        const [timeOff,others]=await Promise.all([
          tx.teacherTimeOff.findMany({
            where:{
              workspaceId,teacherProfileId:series.teacherProfileId,
              startsAt:{lt:latest},endsAt:{gt:earliest},
            },
            select:{startsAt:true,endsAt:true},
          }),
          tx.classSession.findMany({
            where:{
              workspaceId,teacherProfileId:series.teacherProfileId,status:'CONFIRMED',
              id:{notIn:sessions.map(s=>s.id)},
              startsAt:{lt:latest},endsAt:{gt:earliest},
            },
            select:{startsAt:true,endsAt:true},
          }),
        ]);
        const windows=next.map(x=>x.window);
        for(const [index,row] of next.entries()){
          const window=row.window;
          const holiday=holidayConflict(academy,window.startsAt,window.endsAt);
          if(holiday)throw new SeriesEditConflict('Occurrence '+(index+1)+' falls on '+holiday.name+' ('+holiday.date+')');
          if(!withinWeeklyAvailability(regular,window.startsAt,window.endsAt,academy.timezone)){
            throw new SeriesEditConflict('Occurrence '+(index+1)+' falls outside weekly teaching hours');
          }
          if(timeOff.some(x=>intervalsOverlap(x,window))){
            throw new SeriesEditConflict('Occurrence '+(index+1)+' overlaps a teacher absence');
          }
          if(others.some(x=>intervalsOverlap(x,window))){
            throw new SeriesEditConflict('Occurrence '+(index+1)+' overlaps an existing class');
          }
          if(windows.some((x,i)=>i!==index&&intervalsOverlap(x,window))){
            throw new SeriesEditConflict('Two modified occurrences would overlap');
          }
        }
      }

      let updatedSessions=0,affectedBookings=0,inAppNotificationsCreated=0;
      for(const row of next){
        const changedTime=row.session.startsAt.getTime()!==row.window.startsAt.getTime()
          ||row.session.endsAt.getTime()!==row.window.endsAt.getTime();
        const data={
          title:row.updated.title,mode:row.updated.mode,
          location:row.updated.location??null,meetingUrl:row.updated.meetingUrl??null,
          capacity:row.updated.capacity,
          startsAt:row.window.startsAt,endsAt:row.window.endsAt,
          provider:row.updated.meetingUrl?'CUSTOM':null,
        };
        const affected=await tx.classSession.updateMany({
          where:{
            id:row.session.id,workspaceId,seriesId,status:'CONFIRMED',
            startsAt:row.session.startsAt,endsAt:row.session.endsAt,
          },data,
        });
        if(affected.count!==1)throw new SeriesEditConflict('A future class changed during the operation');
        updatedSessions++;
        if(changedTime){
          const count=await tx.classBooking.count({
            where:{workspaceId,sessionId:row.session.id,status:'BOOKED'},
          });
          affectedBookings+=count;
          const change=await tx.sessionChange.create({
            data:{
              sessionId:row.session.id,actorUserId:actorId,reason:input.reason,
              oldStartsAt:row.session.startsAt,oldEndsAt:row.session.endsAt,
              newStartsAt:row.window.startsAt,newEndsAt:row.window.endsAt,
            },
          });
          inAppNotificationsCreated+=await notifyBookedStudents(tx,{
            workspaceId,sessionId:row.session.id,sessionTitle:row.updated.title,
            kind:'SESSION_RESCHEDULED',eventKey:'rescheduled:'+change.id,
          });
        }
      }
      return {
        seriesId,updatedSessions,affectedBookings,inAppNotificationsCreated,
        historicalSessionsPreserved:true as const,
      };
    },{timeout:20000});
  }
}
