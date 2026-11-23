import type {MembershipPort} from './ports.js';
import {parseAssignment,parseCurriculumId,parseTopic} from '../domain/curriculum.js';
import type {CurriculumRepository} from './curriculum-ports.js';

export class CurriculumAccessDenied extends Error {
  constructor(){super('You cannot manage this curriculum');this.name='CurriculumAccessDenied';}
}
export class CurriculumCourseMissing extends Error {
  constructor(){super('Course not found in this workspace');this.name='CurriculumCourseMissing';}
}
export class CurriculumTeacherMissing extends Error {
  constructor(){super('Teacher does not belong to this academy');this.name='CurriculumTeacherMissing';}
}
export class CurriculumParentInvalid extends Error {
  constructor(){super('Parent topic does not belong to this course');this.name='CurriculumParentInvalid';}
}
export class CurriculumTeacherNotAssigned extends Error {
  constructor(){super('Only a teacher assigned to this course can edit its curriculum');this.name='CurriculumTeacherNotAssigned';}
}

export class CurriculumUseCases {
  constructor(private readonly repository:CurriculumRepository,private readonly members:MembershipPort){}
  private async authorize(workspaceId:string,actorId:string,managerOnly:boolean){
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(
      workspaceId,actorId,managerOnly?['OWNER','ADMIN']:['OWNER','ADMIN','TEACHER'],
    ))throw new CurriculumAccessDenied();
  }
  async show(workspaceId:string,actorId:string,courseId:unknown){
    await this.authorize(workspaceId,actorId,false);
    return this.repository.show(workspaceId,actorId,parseCurriculumId(courseId));
  }
  async assign(workspaceId:string,actorId:string,courseId:unknown,raw:unknown){
    await this.authorize(workspaceId,actorId,true);
    return this.repository.assign(workspaceId,actorId,parseCurriculumId(courseId),parseAssignment(raw));
  }
  async unassign(workspaceId:string,actorId:string,courseId:unknown,teacherId:unknown){
    await this.authorize(workspaceId,actorId,true);
    return this.repository.unassign(workspaceId,actorId,parseCurriculumId(courseId),parseCurriculumId(teacherId));
  }
  async createTopic(workspaceId:string,actorId:string,courseId:unknown,raw:unknown){
    await this.authorize(workspaceId,actorId,false);
    return this.repository.createTopic(workspaceId,actorId,parseCurriculumId(courseId),parseTopic(raw));
  }
}
