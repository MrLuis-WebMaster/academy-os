import { BadRequestException, Body, ConflictException, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { requireMembership } from './access.js';

const enrollmentInput=z.object({courseId:z.string().min(1),studentUserId:z.string().min(1)});


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
      select:{id:true,course:{select:{id:true,title:true,summary:true,subject:{select:{name:true}},resources:{where:{workspaceId,published:true},select:{id:true,title:true,source:true,url:true}},sessions:{where:{status:'CONFIRMED',workspaceId},orderBy:{startsAt:'asc'},select:{id:true,title:true,startsAt:true,endsAt:true,mode:true,location:true,meetingUrl:true}}}}},
      orderBy:{createdAt:'desc'},
    });
  }

}
