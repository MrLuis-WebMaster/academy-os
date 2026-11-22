import { SubjectName } from '../domain/subject-name.js';
import type { MembershipPort, SubjectRecord, SubjectRepository } from './ports.js';

export class SubjectAccessDenied extends Error {
  constructor() {
    super('You cannot access these subjects in this workspace');
    this.name = 'SubjectAccessDenied';
  }
}

export class SubjectAlreadyExists extends Error {
  constructor() {
    super('Subject already exists in this workspace');
    this.name = 'SubjectAlreadyExists';
  }
}

/**
 * Application use cases orchestrate domain rules and ports.
 * No NestJS, Prisma or HTTP dependencies.
 */
export class SubjectUseCases {
  constructor(
    private readonly subjects: SubjectRepository,
    private readonly memberships: MembershipPort,
  ) {}

  private async authorize(workspaceId: string, userId: string): Promise<void> {
    if (!workspaceId || !userId || !await this.memberships.hasAnyRole(workspaceId, userId, ['OWNER', 'ADMIN', 'TEACHER'])) {
      throw new SubjectAccessDenied();
    }
  }

  async list(workspaceId: string, userId: string): Promise<SubjectRecord[]> {
    await this.authorize(workspaceId, userId);
    return this.subjects.listByWorkspace(workspaceId);
  }

  async create(workspaceId: string, userId: string, nameInput: unknown): Promise<SubjectRecord> {
    await this.authorize(workspaceId, userId);
    const name = SubjectName.create(nameInput);
    return this.subjects.create({ workspaceId, name: name.value, slug: name.slug });
  }
}
