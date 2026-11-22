import { ForbiddenException } from '@nestjs/common';
import { prisma } from '../lib/prisma.js';

type WorkspaceRole = 'OWNER' | 'ADMIN' | 'TEACHER' | 'STUDENT' | 'GUARDIAN';
export async function requireMembership(workspaceId: string, userId: string, roles?: WorkspaceRole[]) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId, ...(roles ? { role: { in: roles } } : {}) },
  });
  if (!membership) throw new ForbiddenException('You cannot access this workspace resource');
  return membership;
}
