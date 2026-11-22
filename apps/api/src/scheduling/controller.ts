import { BadRequestException, Body, ConflictException, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { requireMembership } from '../workspaces/access.js';
import { bookingInput } from './input.js';

@Controller('workspaces/:workspaceId/sessions')
export class SchedulingController {
  @Get()
  async list(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string) {
    await requireMembership(workspaceId, req.academyUser!.id, ['OWNER','ADMIN','TEACHER']);
    return prisma.classSession.findMany({
      where: { workspaceId },
      select: { id: true, title: true, status: true, mode: true, startsAt: true, endsAt: true, location: true, meetingUrl: true, teacherProfileId: true },
      orderBy: { startsAt: 'asc' },
      take: 100,
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
    if (endsAt.getTime()-startsAt.getTime()>12*60*60*1000) throw new BadRequestException('A session cannot exceed 12 hours');
    try {
      return await prisma.$transaction(async tx => {
        // Same teacher concurrent submissions serialize via a transaction-scoped Postgres advisory lock.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`academy-os:teacher:${teacher.id}`}))`;
        const conflict=await tx.classSession.findFirst({where:{workspaceId,teacherProfileId:teacher.id,status:'CONFIRMED',startsAt:{lt:endsAt},endsAt:{gt:startsAt}}});
        if(conflict) throw new ConflictException('Teacher already has a class during this period');
        return tx.classSession.create({data:{workspaceId,teacherProfileId:teacher.id,courseId:data.courseId,title:data.title,mode:data.mode,status:'CONFIRMED',startsAt,endsAt,timezone:'UTC',capacity:data.capacity,location:data.location,meetingUrl:data.meetingUrl,provider:data.meetingUrl?'CUSTOM':undefined},select:{id:true,title:true,mode:true,startsAt:true,endsAt:true,status:true}});
      });
    } catch(e){if(e instanceof ConflictException)throw e;throw e;}
  }
}
