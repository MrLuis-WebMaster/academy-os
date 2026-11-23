import {prisma} from '../../../lib/prisma.js';
import type {WeeklySeriesRepository,WeeklySeriesTemplate} from '../application/weekly-series-ports.js';
import type {LessonWindow} from '../domain/weekly-series.js';
import {withinWeeklyAvailability} from '../domain/weekly-availability.js';
import {holidayConflict} from '../domain/public-holidays.js';
import {intervalsOverlap} from '../domain/time-off.js';
import {WeeklySeriesConflict,WeeklySeriesReferenceInvalid,WeeklySeriesNotAllowed} from '../application/create-weekly-series-use-case.js';

export class PrismaWeeklySeriesRepository implements WeeklySeriesRepository {
 async workspaceTimezone(workspaceId:string){
  return (await prisma.workspace.findUnique({where:{id:workspaceId},select:{timezone:true}}))?.timezone??null;
 }
 async isAssignedTeacher(workspaceId:string,userId:string,teacherProfileId:string){
  return Boolean(await prisma.teacherProfile.findFirst({
   where:{workspaceId,userId,id:teacherProfileId},select:{id:true},
  }));
 }
 async create(workspaceId:string,actorId:string,draft:WeeklySeriesTemplate,windows:readonly LessonWindow[],timeZone:string){
  return prisma.$transaction(async tx=>{
   // Same teacher advisory key as single-session creation, rescheduling and vacation blocks.
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:teacher:'+draft.teacherProfileId}))::text AS lock_acquired`;
   const [teacher,memberships]=await Promise.all([
    tx.teacherProfile.findFirst({
     where:{id:draft.teacherProfileId,workspaceId},select:{id:true,userId:true},
    }),
    tx.workspaceMember.findMany({
     where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
     select:{role:true},
    }),
   ]);
   if(!teacher)throw new WeeklySeriesReferenceInvalid('Teacher is outside this academy');
   const isManager=memberships.some(member=>member.role==='OWNER'||member.role==='ADMIN');
   if(!memberships.length||(!isManager&&teacher.userId!==actorId)){
    throw new WeeklySeriesNotAllowed();
   }

   if(draft.courseId){
    const course=await tx.course.findFirst({where:{id:draft.courseId,workspaceId},select:{id:true}});
    if(!course)throw new WeeklySeriesReferenceInvalid('Course is outside this academy');
   }
   if(draft.roomId){
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:room:'+draft.roomId}))::text AS lock_acquired`;
    const room=await tx.teachingRoom.findFirst({
     where:{workspaceId,id:draft.roomId,active:true,campus:{workspaceId,active:true}},
     select:{capacity:true},
    });
    if(!room)throw new WeeklySeriesReferenceInvalid('Physical room is not available in this academy');
    if(draft.capacity>room.capacity)throw new WeeklySeriesConflict('Class size exceeds physical room capacity');
   }
   const first=windows[0],last=windows[windows.length-1];
   if(!first||!last)throw new WeeklySeriesReferenceInvalid('No lesson occurrences were generated');
   const policy=await tx.workspace.findUnique({
    where:{id:workspaceId},select:{timezone:true,holidayCountry:true,avoidPublicHolidays:true},
   });
   if(!policy)throw new WeeklySeriesReferenceInvalid('Academy no longer exists');

   const [regularHours,timeOff,existing,roomBookings]=await Promise.all([
    tx.weeklyAvailability.findMany({
     where:{workspaceId,teacherProfileId:teacher.id},
     select:{dayOfWeek:true,startMinute:true,endMinute:true},
    }),
    tx.teacherTimeOff.findMany({
     where:{workspaceId,teacherProfileId:teacher.id,startsAt:{lt:last.endsAt},endsAt:{gt:first.startsAt}},
     select:{startsAt:true,endsAt:true},
    }),
    tx.classSession.findMany({
     where:{workspaceId,teacherProfileId:teacher.id,status:'CONFIRMED',
      startsAt:{lt:last.endsAt},endsAt:{gt:first.startsAt}},
     select:{startsAt:true,endsAt:true},
    }),
    draft.roomId?tx.classSession.findMany({
     where:{
      workspaceId,roomId:draft.roomId,status:'CONFIRMED',
      startsAt:{lt:last.endsAt},endsAt:{gt:first.startsAt},
     },
     select:{startsAt:true,endsAt:true},
    }):Promise.resolve([] as Array<{startsAt:Date;endsAt:Date}>),
   ]);
   for(const [i,window] of windows.entries()){
    const holiday=holidayConflict(policy,window.startsAt,window.endsAt);
    if(holiday)throw new WeeklySeriesConflict('Occurrence '+(i+1)+' falls on '+holiday.name+' ('+holiday.date+')');
    if(!withinWeeklyAvailability(regularHours,window.startsAt,window.endsAt,timeZone))
     throw new WeeklySeriesConflict('Occurrence '+(i+1)+' is outside regular teaching hours');
    if(timeOff.some(x=>intervalsOverlap(x,window)))
     throw new WeeklySeriesConflict('Occurrence '+(i+1)+' overlaps a scheduled absence');
    if(roomBookings.some(x=>intervalsOverlap(x,window)))
     throw new WeeklySeriesConflict('Occurrence '+(i+1)+' conflicts with a physical room reservation');
    if(existing.some(x=>intervalsOverlap(x,window)))
     throw new WeeklySeriesConflict('Occurrence '+(i+1)+' overlaps another confirmed class');
   }
   // Either every occurrence exists, or the transaction rolls back all of them.
   const series=await tx.classSeries.create({
    data:{
     workspaceId,teacherProfileId:teacher.id,createdByUserId:actorId,
     repeatWeeks:windows.length,firstStartsAt:first.startsAt,timezone:timeZone,
    },
    select:{id:true},
   });
   const lessons:Array<{id:string;title:string;startsAt:Date;endsAt:Date;seriesIndex:number}>=[];
   for(const [index,window] of windows.entries()){
    const created=await tx.classSession.create({
     data:{
      workspaceId,teacherProfileId:teacher.id,courseId:draft.courseId||null,
      title:draft.title,mode:draft.mode,status:'CONFIRMED',
      startsAt:window.startsAt,endsAt:window.endsAt,timezone:timeZone,
      capacity:draft.capacity,location:draft.location,meetingUrl:draft.meetingUrl,
      roomId:draft.roomId??null,
      provider:draft.meetingUrl?'CUSTOM':undefined,
      seriesId:series.id,seriesIndex:index,
     },
     select:{id:true,title:true,startsAt:true,endsAt:true,seriesIndex:true},
    });
    lessons.push({id:created.id,title:created.title,
     startsAt:created.startsAt,endsAt:created.endsAt,seriesIndex:created.seriesIndex!});
   }
   return {seriesId:series.id,count:lessons.length,timeZone,lessons};
  });
 }
}
