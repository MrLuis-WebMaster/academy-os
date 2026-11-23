import type {MembershipPort} from '../../academics/application/ports.js';
import {
  parseAttempt,parsePracticeDraft,parsePracticeId,parsePracticeRevision,
} from '../domain/practice.js';
import type {PracticeRepository} from './practice-ports.js';

export class PracticeAccessDenied extends Error {
  constructor(){super('You cannot access practices in this academy');this.name='PracticeAccessDenied';}
}
export class PracticeNotFound extends Error {
  constructor(message='Activity not found'){super(message);this.name='PracticeNotFound';}
}
export class PracticePrerequisiteMissing extends Error {
  constructor(){super('Save a Class Alive reflection before creating activities');this.name='PracticePrerequisiteMissing';}
}
export class PracticeConflict extends Error {
  constructor(message='Published or answered exercises cannot be modified'){
    super(message);this.name='PracticeConflict';
  }
}

export class PracticeUseCases {
  constructor(private readonly practices:PracticeRepository,private readonly members:MembershipPort){}
  private async authorize(workspaceId:string,actorId:string,student:boolean):Promise<void>{
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(
      workspaceId,actorId,student?['STUDENT']:['OWNER','ADMIN','TEACHER'],
    ))throw new PracticeAccessDenied();
  }
  async create(workspaceId:string,actorId:string,raw:unknown){
    await this.authorize(workspaceId,actorId,false);
    return this.practices.create(workspaceId,actorId,parsePracticeDraft(raw));
  }
  async teacher(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId,false);
    return this.practices.listTeacher(workspaceId,actorId);
  }
  async revise(workspaceId:string,actorId:string,activityId:unknown,raw:unknown){
    await this.authorize(workspaceId,actorId,false);
    return this.practices.revise(workspaceId,actorId,parsePracticeId(activityId),parsePracticeRevision(raw));
  }
  async publish(workspaceId:string,actorId:string,activityId:unknown){
    await this.authorize(workspaceId,actorId,false);
    return this.practices.publish(workspaceId,actorId,parsePracticeId(activityId));
  }
  async student(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId,true);
    return this.practices.listStudent(workspaceId,actorId);
  }
  async submit(workspaceId:string,actorId:string,activityId:unknown,raw:unknown){
    await this.authorize(workspaceId,actorId,true);
    return this.practices.submit(workspaceId,actorId,parsePracticeId(activityId),parseAttempt(raw).answers);
  }
  async passport(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId,true);
    return this.practices.passport(workspaceId,actorId);
  }
}
