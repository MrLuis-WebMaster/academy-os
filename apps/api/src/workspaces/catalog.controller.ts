import { BadRequestException, Body, ConflictException, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { requireMembership } from './access.js';

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
}
