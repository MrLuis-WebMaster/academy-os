import {prisma} from '../../../lib/prisma.js';
import {notifyBookedStudents} from '../../notifications/infrastructure/session-notice-publisher.js';
import {withinWeeklyAvailability} from '../domain/weekly-availability.js';
import {holidayConflict} from '../domain/public-holidays.js';
import {ensureMayCancelLesson} from '../domain/lesson.js';
import type {LessonDraft} from '../domain/lesson.js';
import type {LessonRepository} from '../application/lesson-ports.js';
import {
  LessonAccessDenied,LessonConflict,LessonNotFound,LessonReferenceInvalid,
} from '../application/lesson-use-cases.js';

export class PrismaLessonRepository implements LessonRepository {
  async list(workspaceId:string,actorId:string) {
    // A professor never sees sessions assigned to other teachers.
    const memberships=await prisma.workspaceMember.findMany({
      where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
      select:{role:true},
    });
    if(!memberships.length)throw new LessonAccessDenied();
    const isManager=memberships.some(member=>member.role==='OWNER'||member.role==='ADMIN');
    return prisma.classSession.findMany({
      where:{workspaceId,...(!isManager?{teacher:{workspaceId,userId:actorId}}:{})},
      select:{
        id:true,title:true,status:true,mode:true,startsAt:true,endsAt:true,
        location:true,meetingUrl:true,capacity:true,teacherProfileId:true,courseId:true,
        seriesId:true,seriesIndex:true,
      },
      orderBy:{startsAt:'asc'},take:100,
    });
  }

  async create(workspaceId:string,actorId:string,plan:LessonDraft) {
    return prisma.$transaction(async tx=>{
      // Same key used by weekly series, reschedule, and teacher time-off.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:teacher:'+plan.teacherProfileId}))::text AS lock_acquired`;
      const [memberships,teacher,academy,course]=await Promise.all([
        tx.workspaceMember.findMany({
          where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
          select:{role:true},
        }),
        tx.teacherProfile.findFirst({
          where:{id:plan.teacherProfileId,workspaceId},select:{id:true,userId:true},
        }),
        tx.workspace.findUnique({where:{id:workspaceId},select:{timezone:true,holidayCountry:true,avoidPublicHolidays:true}}),
        plan.courseId
          ?tx.course.findFirst({where:{id:plan.courseId,workspaceId},select:{id:true}})
          :Promise.resolve(null),
      ]);
      if(!memberships.length)throw new LessonAccessDenied();
      const isManager=memberships.some(member=>member.role==='OWNER'||member.role==='ADMIN');
      if(!teacher)throw new LessonReferenceInvalid('Teacher does not belong to this workspace');
      if(!isManager&&teacher.userId!==actorId)throw new LessonAccessDenied();
      if(plan.courseId&&!course)throw new LessonReferenceInvalid('Course does not belong to this workspace');
      if(!academy)throw new LessonReferenceInvalid('Workspace does not exist');
      const holiday=holidayConflict(academy,plan.startsAt,plan.endsAt);
      if(holiday)throw new LessonConflict('Class falls on a national holiday: '+holiday.name+' ('+holiday.date+')');


      if(plan.roomId){
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:room:'+plan.roomId}))::text AS lock_acquired`;
        const room=await tx.teachingRoom.findFirst({
          where:{workspaceId,id:plan.roomId,active:true,campus:{workspaceId,active:true}},
          select:{capacity:true},
        });
        if(!room)throw new LessonReferenceInvalid('Physical room is unavailable in this academy');
        if(plan.capacity>room.capacity){
          throw new LessonConflict('Class capacity exceeds the physical room capacity');
        }
        const occupiedRoom=await tx.classSession.findFirst({
          where:{
            workspaceId,roomId:plan.roomId,status:'CONFIRMED',
            startsAt:{lt:plan.endsAt},endsAt:{gt:plan.startsAt},
          },select:{id:true},
        });
        if(occupiedRoom)throw new LessonConflict('Physical room is already booked in this time slot');
      }
      const [regularHours,blocked,conflict]=await Promise.all([
        tx.weeklyAvailability.findMany({
          where:{workspaceId,teacherProfileId:teacher.id},
          select:{dayOfWeek:true,startMinute:true,endMinute:true},
        }),
        tx.teacherTimeOff.findFirst({
          where:{
            workspaceId,teacherProfileId:teacher.id,
            startsAt:{lt:plan.endsAt},endsAt:{gt:plan.startsAt},
          },select:{id:true},
        }),
        tx.classSession.findFirst({
          where:{
            workspaceId,teacherProfileId:teacher.id,status:'CONFIRMED',
            startsAt:{lt:plan.endsAt},endsAt:{gt:plan.startsAt},
          },select:{id:true},
        }),
      ]);
      if(!withinWeeklyAvailability(regularHours,plan.startsAt,plan.endsAt,academy.timezone)){
        throw new LessonConflict('Class is outside this teacher\'s configured weekly availability');
      }
      if(blocked)throw new LessonConflict('Teacher is unavailable during this period');
      if(conflict)throw new LessonConflict('Teacher already has a class during this period');
      return tx.classSession.create({
        data:{
          workspaceId,teacherProfileId:teacher.id,courseId:plan.courseId||null,
          title:plan.title,mode:plan.mode,status:'CONFIRMED',
          startsAt:plan.startsAt,endsAt:plan.endsAt,timezone:academy.timezone,
          capacity:plan.capacity,location:plan.location,meetingUrl:plan.meetingUrl,
          roomId:plan.roomId??null,
          provider:plan.meetingUrl?'CUSTOM':undefined,
        },
        select:{id:true,title:true,mode:true,startsAt:true,endsAt:true,status:true},
      });
    });
  }

  async cancel(workspaceId:string,actorId:string,lessonId:string) {
    return prisma.$transaction(async tx=>{
      // Lock booking first to coordinate with reservations, reprogramming, attendance
      // and cancellations of recurring series, then the instructor schedule lock.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+lessonId}))::text AS lock_acquired`;
      const candidate=await tx.classSession.findFirst({
        where:{id:lessonId,workspaceId},select:{teacherProfileId:true},
      });
      if(!candidate)throw new LessonNotFound();
      if(candidate.teacherProfileId){
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:teacher:'+candidate.teacherProfileId}))::text AS lock_acquired`;
      }
      const [memberships,session]=await Promise.all([
        tx.workspaceMember.findMany({
          where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
          select:{role:true},
        }),
        tx.classSession.findFirst({
          where:{id:lessonId,workspaceId},
          select:{
            id:true,title:true,status:true,
            teacher:{select:{userId:true}},
          },
        }),
      ]);
      if(!memberships.length)throw new LessonAccessDenied();
      if(!session)throw new LessonNotFound();
      const isManager=memberships.some(member=>member.role==='OWNER'||member.role==='ADMIN');
      ensureMayCancelLesson(session.status,actorId,session.teacher?.userId??null,isManager);
      if(session.status==='CANCELLED'){
        return {id:session.id,status:'CANCELLED' as const,inAppNotificationsCreated:0};
      }
      const updated=await tx.classSession.updateMany({
        where:{id:session.id,workspaceId,status:{in:['DRAFT','CONFIRMED']}},
        data:{status:'CANCELLED'},
      });
      if(updated.count!==1)throw new LessonConflict('The class status changed; please refresh');
      const inAppNotificationsCreated=await notifyBookedStudents(tx,{
        workspaceId,sessionId:session.id,sessionTitle:session.title,
        kind:'SESSION_CANCELLED',eventKey:'cancelled:'+session.id,
      });
      return {id:session.id,status:'CANCELLED' as const,inAppNotificationsCreated};
    });
  }
}
