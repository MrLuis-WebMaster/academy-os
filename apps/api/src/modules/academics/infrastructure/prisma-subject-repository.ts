import { prisma } from '../../../lib/prisma.js';
import type { MembershipPort, SubjectRecord, SubjectRepository, WorkspaceRole } from '../application/ports.js';
import { SubjectAlreadyExists } from '../application/subject-use-cases.js';

export class PrismaSubjectRepository implements SubjectRepository {
  async listByWorkspace(workspaceId: string): Promise<SubjectRecord[]> {
    return prisma.subject.findMany({
      where: { workspaceId },
      select: { id: true, workspaceId: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(input: { workspaceId: string; name: string; slug: string }): Promise<SubjectRecord> {
    try {
      return await prisma.subject.create({
        data: input,
        select: { id: true, workspaceId: true, name: true, slug: true },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new SubjectAlreadyExists();
      }
      throw error;
    }
  }
}

export class PrismaMembershipAdapter implements MembershipPort {
  async hasAnyRole(workspaceId: string, userId: string, roles: readonly WorkspaceRole[]): Promise<boolean> {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, role: { in: [...roles] } },
      select: { id: true },
    });
    return Boolean(member);
  }
}
