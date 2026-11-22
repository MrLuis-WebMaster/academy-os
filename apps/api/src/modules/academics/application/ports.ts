export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'TEACHER' | 'STUDENT' | 'GUARDIAN';

export interface SubjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
}

export interface SubjectRepository {
  listByWorkspace(workspaceId: string): Promise<SubjectRecord[]>;
  create(input: { workspaceId: string; name: string; slug: string }): Promise<SubjectRecord>;
}

export interface MembershipPort {
  hasAnyRole(workspaceId: string, userId: string, roles: readonly WorkspaceRole[]): Promise<boolean>;
}
