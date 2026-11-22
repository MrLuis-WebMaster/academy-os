import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { requireMembership } from '../workspaces/access.js';
import { bookingInput } from './input.js';
import {withinWeeklyAvailability} from '../modules/scheduling/domain/weekly-availability.js';
import {notifyBookedStudents} from '../modules/notifications/infrastructure/session-notice-publisher.js';

@Controller('workspaces/:workspaceId/sessions')
export class SchedulingController {
  @Get()
  async list(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string) {
    await requireMembership(workspaceId, req.academyUser!.id, ['OWNER','ADMIN','TEACHER']);
    return prisma.classSession.findMany({
      where: { workspaceId },
      select: { id: true, title: true, status: true, mode: true, startsAt: true, endsAt: true, location: true, meetingUrl: true, teacherProfileId: true, courseId: true },
      orderBy: { startsAt: 'asc' },
      take: 100,
    });
  }

  @Patch(':sessionId/cancel')
  async cancel(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('sessionId') sessionId:string){
    const userId=req.academyUser!.id;
    const member=await requireMembership(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    return prisma.$transaction(async tx=>{
      // Reserve and cancel serialize on the same session lock; notifications are atomic.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+sessionId}))::text AS lock_acquired`;
      const session=await tx.classSession.findFirst({
        where:{id:sessionId,workspaceId},
        select:{id:true,title:true,status:true,teacher:{select:{userId:true}}},
      });
      if(!session)throw new NotFoundException('Class not found in this workspace');
      if(member.role==='TEACHER'&&session.teacher?.userId!==userId)
        throw new ForbiddenException('You can only cancel your own lessons');
      if(session.status==='COMPLETED')throw new BadRequestException('Completed lessons cannot be cancelled');
      if(session.status==='CANCELLED')return {id:session.id,status:'CANCELLED',inAppNotificationsCreated:0};
      const result=await tx.classSession.updateMany({
        where:{id:session.id,workspaceId,status:{in:['DRAFT','CONFIRMED']}},
        data:{status:'CANCELLED'},
      });
      if(result.count!==1)throw new ConflictException('The class status changed; please refresh');
      const inAppNotificationsCreated=await notifyBookedStudents(tx,{
        workspaceId,sessionId,sessionTitle:session.title,
        kind:'SESSION_CANCELLED',eventKey:'cancelled:'+sessionId,
      });
      return {id:session.id,status:'CANCELLED',inAppNotificationsCreated};
    });
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    await requireMembership(workspaceId, req.academyUser!.id, ['OWNER','ADMIN','TEACHER']);
    const result = bookingInput.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues.map(issue=>({ path:issue.path.join('.'), message:issue.message })));
    const data = result.data;
    const teacher = await prisma.teacherProfile.findFirst({ where: { id: data.teacherProfileId, workspaceId } });
    if (!teacher) throw new BadRequestException('Teacher does not belong to this workspace');
    // Teachers cannot create lessons on other teachers' calendars. Admins/owners may delegate.
    if (teacher.userId !== req.academyUser!.id) {
      await requireMembership(workspaceId, req.academyUser!.id, ['OWNER','ADMIN']);
    }
    if(data.courseId){const course=await prisma.course.findFirst({where:{id:data.courseId,workspaceId}});if(!course)throw new BadRequestException('Course does not belong to this workspace');}
    const startsAt = new Date(data.startsAt), endsAt = new Date(data.endsAt);
    const academy=await prisma.workspace.findUnique({where:{id:workspaceId},select:{timezone:true}});
    if(!academy)throw new BadRequestException('Workspace does not exist');
    if (endsAt.getTime()-startsAt.getTime()>12*60*60*1000) throw new BadRequestException('A session cannot exceed 12 hours');
    try {
      return await prisma.$transaction(async tx => {
        // Same teacher concurrent submissions serialize via a transaction-scoped Postgres advisory lock.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`academy-os:teacher:${teacher.id}`}))::text AS lock_acquired`;
        const regularHours=await tx.weeklyAvailability.findMany({
          where:{workspaceId,teacherProfileId:teacher.id},
          select:{dayOfWeek:true,startMinute:true,endMinute:true},
        });
        if(!withinWeeklyAvailability(regularHours,startsAt,endsAt,academy.timezone))
          throw new ConflictException('Class is outside this teacher\'s configured weekly availability');
        const conflict=await tx.classSession.findFirst({where:{workspaceId,teacherProfileId:teacher.id,status:'CONFIRMED',startsAt:{lt:endsAt},endsAt:{gt:startsAt}}});
        if(conflict) throw new ConflictException('Teacher already has a class during this period');
        return tx.classSession.create({data:{workspaceId,teacherProfileId:teacher.id,courseId:data.courseId,title:data.title,mode:data.mode,status:'CONFIRMED',startsAt,endsAt,timezone:academy.timezone,capacity:data.capacity,location:data.location,meetingUrl:data.meetingUrl,provider:data.meetingUrl?'CUSTOM':undefined},select:{id:true,title:true,mode:true,startsAt:true,endsAt:true,status:true}});
      });
    } catch(e){if(e instanceof ConflictException)throw e;throw e;}
  }
}
