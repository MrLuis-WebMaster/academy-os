import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { requireMembership } from '../workspaces/access.js';

export const noteInput=z.object({notes:z.string().trim().min(10).max(12000)});

@Controller('workspaces/:workspaceId/class-alive')
export class ClassAliveController {
  private async requireTeachingAccess(workspaceId:string,userId:string,sessionId:string) {
    const member=await requireMembership(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    const session=await prisma.classSession.findFirst({where:{workspaceId,id:sessionId},select:{id:true,teacherProfileId:true,courseId:true}});
    if(!session)throw new NotFoundException('Class not found');
    if(!session.courseId)throw new BadRequestException('Class Alive requires a class associated with a course');
    if(member.role==='TEACHER'){
      const profile=await prisma.teacherProfile.findFirst({where:{workspaceId,userId},select:{id:true}});
      if(!profile||profile.id!==session.teacherProfileId)throw new ForbiddenException('Only the assigned teacher can edit this class');
    }
    return session;
  }

  @Post('sessions/:sessionId/notes')
  async save(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('sessionId') sessionId:string,@Body() input:unknown) {
    const parsed=noteInput.safeParse(input);
    if(!parsed.success)throw new BadRequestException('Please provide at least 10 characters of notes');
    await this.requireTeachingAccess(workspaceId,req.academyUser!.id,sessionId);
    const existing=await prisma.classReflection.findUnique({where:{sessionId}});
    if(existing?.status==='PUBLISHED')throw new ConflictException('This Class Alive note was already published');
    return prisma.classReflection.upsert({
      where:{sessionId},
      create:{sessionId,notes:parsed.data.notes,status:'DRAFT'},
      update:{notes:parsed.data.notes,status:'DRAFT'},
      select:{id:true,sessionId:true,status:true,notes:true},
    });
  }

  @Post('sessions/:sessionId/publish')
  async publish(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('sessionId') sessionId:string) {
    await this.requireTeachingAccess(workspaceId,req.academyUser!.id,sessionId);
    const updated=await prisma.classReflection.updateMany({
      where:{sessionId,status:{in:['DRAFT','REVIEW']},notes:{not:''}},
      data:{status:'PUBLISHED',approvedAt:new Date()},
    });
    if(updated.count!==1)throw new ConflictException('Save a draft note before publishing or refresh this class');
    return prisma.classReflection.findUnique({where:{sessionId},select:{id:true,status:true,approvedAt:true}});
  }

  @Get('notes')
  async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string) {
    const userId=req.academyUser!.id;
    const member=await requireMembership(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    const where=member.role==='TEACHER'
      ? {session:{workspaceId,teacher:{userId}}}
      : {session:{workspaceId}};
    return prisma.classReflection.findMany({
      where,select:{id:true,sessionId:true,status:true,notes:true,approvedAt:true,session:{select:{title:true,courseId:true}}},
      take:100,
    });
  }

  @Get('published')
  async published(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string) {
    const userId=req.academyUser!.id;
    await requireMembership(workspaceId,userId,['STUDENT']);
    return prisma.classReflection.findMany({
      where:{status:'PUBLISHED',session:{workspaceId,course:{enrollments:{some:{userId}}}}},
      select:{id:true,notes:true,approvedAt:true,session:{select:{id:true,courseId:true,title:true}}},
      orderBy:{approvedAt:'desc'},take:100,
    });
  }
}
