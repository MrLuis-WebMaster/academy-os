import { Body, ConflictException, Controller, Get, HttpException, HttpStatus, InternalServerErrorException, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { parseWorkspaceInput, slugify } from './inputs.js';

@Controller('workspaces')
export class WorkspaceController {
  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    return prisma.workspaceMember.findMany({
      where: { userId: req.academyUser!.id },
      select: { role: true, workspace: { select: { id: true, name: true, slug: true, type: true, brandColor: true, timezone: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() payload: unknown) {
    let input: ReturnType<typeof parseWorkspaceInput>;
    try { input = parseWorkspaceInput(payload); }
    catch { throw new HttpException('Invalid workspace configuration', HttpStatus.BAD_REQUEST); }
    const userId = req.academyUser!.id;
    const previous = await prisma.setupRequest.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } }, include: { workspace: true } });
    if (previous) return { ...previous.workspace, role: 'OWNER' as const };
    try {
      return await prisma.$transaction(async tx => {
        const workspace = await tx.workspace.create({
          data: {
            name: input.name, slug: input.slug, type: input.type, timezone: input.timezone,
            members: { create: { userId, role: 'OWNER' } },
            teachers: { create: { userId } },
            subjects: { create: input.subjects.map(name => ({ name, slug: slugify(name) })) },
          },
        });
        await tx.setupRequest.create({ data: { userId, requestId: input.requestId, workspaceId: workspace.id } });
        return { ...workspace, role: 'OWNER' as const };
      });
    } catch (err) {
      // Duplicate concurrent submission: return only the workspace created by this same user/request.
      const existing = await prisma.setupRequest.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } }, include: { workspace: true } });
      if (existing) return { ...existing.workspace, role: 'OWNER' as const };
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') throw new ConflictException('That workspace name or slug is already taken');
      throw new InternalServerErrorException('Unable to create workspace');
    }
  }

}
