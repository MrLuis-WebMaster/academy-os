import { BadRequestException, Body, ConflictException, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { requireMembership } from './access.js';

const enrollmentInput=z.object({courseId:z.string().min(1),studentUserId:z.string().min(1)});

const courseInput = z.object({
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().max(2000).optional(),
  subjectId: z.string().min(1).optional(),
});

@Controller('workspaces/:workspaceId')
export class CatalogController {
  @Get('people')
  async people(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string) {
    await requireMembership(workspaceId, req.academyUser!.id, ['OWNER','ADMIN']);
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { role: true, user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  @Get('teachers')
  async teachers(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string) {
    await requireMembership(workspaceId, req.academyUser!.id, ['OWNER','ADMIN','TEACHER']);
    return prisma.teacherProfile.findMany({
      where: { workspaceId },
      select: { id: true, bio: true, userId: true, user: { select: { name: true, image: true } } },
    });
  }

  @Get('courses')
  async courses(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string) {
    await requireMembership(workspaceId, req.academyUser!.id, ['OWNER','ADMIN','TEACHER']);
    return prisma.course.findMany({
      where: { workspaceId },
      select: { id: true, title: true, summary: true, published: true, subjectId: true, subject: { select: { id: true, name: true } } },
      orderBy: { title: 'asc' },
    });
  }

  @Post('courses')
  async createCourse(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string, @Body() payload: unknown) {
    await requireMembership(workspaceId, req.academyUser!.id, ['OWNER','ADMIN','TEACHER']);
    const parsed = courseInput.safeParse(payload);
    if (!parsed.success) throw new BadRequestException('Invalid course details');
    const { title, summary, subjectId } = parsed.data;
    if (subjectId) {
      const subject = await prisma.subject.findFirst({ where: { id: subjectId, workspaceId } });
      if (!subject) throw new BadRequestException('Subject does not belong to this workspace');
    }
    try { return await prisma.course.create({ data: { title, summary, subjectId, workspaceId }, select: { id: true, title: true, summary: true, subjectId: true } }); }
    catch (e) { throw new ConflictException('Unable to create course'); }
  }

  @Post('enrollments')
  async enroll(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string, @Body() body:unknown) {
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    const parsed=enrollmentInput.safeParse(body);
    if(!parsed.success)throw new BadRequestException('Invalid enrollment');
    const {courseId,studentUserId}=parsed.data;
    const [course,member]=await Promise.all([
      prisma.course.findFirst({where:{id:courseId,workspaceId}}),
      prisma.workspaceMember.findFirst({where:{workspaceId,userId:studentUserId,role:'STUDENT'}}),
    ]);
    if(!course||!member)throw new BadRequestException('Student and course must belong to this academy');
    try{return await prisma.enrollment.create({data:{courseId,userId:studentUserId},select:{id:true,courseId:true,userId:true,createdAt:true}});}
    catch(e){if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2002')throw new ConflictException('Student is already enrolled');throw e;}
  }

  @Get('classroom')
  async classroom(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string) {
    await requireMembership(workspaceId,req.academyUser!.id,['STUDENT']);
    return prisma.enrollment.findMany({
      where:{userId:req.academyUser!.id,course:{workspaceId}},
      select:{id:true,course:{select:{id:true,title:true,summary:true,subject:{select:{name:true}},resources:{select:{id:true,title:true,source:true,url:true}},sessions:{where:{status:'CONFIRMED'},orderBy:{startsAt:'asc'},select:{id:true,title:true,startsAt:true,endsAt:true,mode:true,location:true,meetingUrl:true}}}}},
      orderBy:{createdAt:'desc'},
    });
  }

}
