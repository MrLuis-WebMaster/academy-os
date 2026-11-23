import { createCourseDraft,InvalidCourseDetails } from '../domain/course-draft.js';
import type { MembershipPort } from './ports.js';
import type { CourseRepository } from './course-ports.js';
import { SubjectAccessDenied } from './subject-use-cases.js';

export class CourseSubjectOutsideWorkspace extends Error {
  constructor() {
    super('Subject does not belong to this workspace');
    this.name='CourseSubjectOutsideWorkspace';
  }
}

export class CoursePolicyConflict extends Error {
 constructor(message='Existing future bookings without package credits prevent enabling paid access'){
  super(message);this.name='CoursePolicyConflict';
 }
}
export class CourseNotFound extends Error {
 constructor(){super('Course does not exist in this academy');this.name='CourseNotFound';}
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

  async setPackageRequirement(workspaceId:string,userId:string,courseId:unknown,raw:unknown){
    if(!workspaceId||!userId||!await this.members.hasAnyRole(workspaceId,userId,['OWNER','ADMIN'])){
      throw new SubjectAccessDenied();
    }
    if(typeof courseId!=='string'||!courseId.trim()||courseId.length>128
      ||!raw||typeof raw!=='object'
      ||Object.keys(raw).length!==1
      ||(raw as Record<string,unknown>).requiresPackage!==true
       &&(raw as Record<string,unknown>).requiresPackage!==false){
      throw new InvalidCourseDetails('Provide only the boolean requiresPackage field');
    }
    return this.courses.setPackageRequirement(
      workspaceId,userId,courseId,(raw as {requiresPackage:boolean}).requiresPackage,
    );
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
