import { Body, ConflictException, Controller, ForbiddenException, Get, HttpException, HttpStatus, InternalServerErrorException, Param, Post, Req } from '@nestjs/common';
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

  @Get(':workspaceId/subjects')
  async subjects(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string) {
    await this.authorize(workspaceId, req.academyUser!.id);
    return prisma.subject.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
  }

  @Post(':workspaceId/subjects')
  async addSubject(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    await this.authorize(workspaceId, req.academyUser!.id, ['OWNER','ADMIN','TEACHER']);
    if (typeof body !== 'object' || body === null || !('name' in body) || typeof body.name !== 'string') throw new HttpException('Subject name required', 400);
    const name = body.name.trim();
    const slug = slugify(name);
    if (name.length < 2 || name.length > 75 || slug.length < 2) throw new HttpException('Invalid subject', 400);
    try { return await prisma.subject.create({ data: { workspaceId, name, slug } }); }
    catch (e) { if (typeof e==='object' && e!==null && 'code' in e && e.code==='P2002') throw new ConflictException('Subject already exists'); throw e; }
  }

  private async authorize(workspaceId: string, userId: string, roles?: Array<'OWNER'|'ADMIN'|'TEACHER'>) {
    const membership = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId, ...(roles ? { role: { in: roles } } : {}) } });
    if (!membership) throw new ForbiddenException('Workspace not accessible');
  }
}
