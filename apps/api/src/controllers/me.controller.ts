import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { googleConfigured } from '../auth/auth.js';
import { prisma } from '../lib/prisma.js';
import { Public } from '../auth/public.js';

@Controller()
export class MeController {
  @Public()
  @Get('auth-config')
  config() { return { googleConfigured, provider: 'Better Auth' }; }

  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    const user = request.academyUser!;
    const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id }, select: { role: true, workspace: { select: { id: true, name: true, type: true, slug: true, brandColor: true } } }, orderBy: { joinedAt: 'asc' } });
    return { user, memberships };
  }
}
