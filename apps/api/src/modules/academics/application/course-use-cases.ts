import { createCourseDraft } from '../domain/course-draft.js';
import type { MembershipPort } from './ports.js';
import type { CourseRepository } from './course-ports.js';
import { SubjectAccessDenied } from './subject-use-cases.js';

export class CourseSubjectOutsideWorkspace extends Error {
  constructor() {
    super('Subject does not belong to this workspace');
    this.name='CourseSubjectOutsideWorkspace';
  }
}

export class CourseUseCases {
  constructor(
    private readonly courses: CourseRepository,
    private readonly members: MembershipPort,
  ) {}

  private async authorize(workspaceId:string,userId:string) {
    if(!workspaceId||!userId||!await this.members.hasAnyRole(workspaceId,userId,['OWNER','ADMIN','TEACHER'])){
      throw new SubjectAccessDenied();
    }
  }

  async list(workspaceId:string,userId:string){
    await this.authorize(workspaceId,userId);
    return this.courses.listByWorkspace(workspaceId);
  }

  async create(workspaceId:string,userId:string,input:unknown){
    await this.authorize(workspaceId,userId);
    const draft=createCourseDraft(input);
    if(draft.subjectId && !await this.courses.subjectExists(workspaceId,draft.subjectId)){
      throw new CourseSubjectOutsideWorkspace();
    }
    return this.courses.create(workspaceId,draft);
  }
}
