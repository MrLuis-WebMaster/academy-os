import { Controller, Get, Param, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { requireMembership } from './access.js';

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
