import type {MembershipPort} from '../../academics/application/ports.js';
import {parseLessonDraft,parseLessonId} from '../domain/lesson.js';
import type {LessonRepository} from './lesson-ports.js';

export class LessonAccessDenied extends Error {
  constructor(){super('Only academy managers and teachers can manage lessons');this.name='LessonAccessDenied';}
}
export class LessonReferenceInvalid extends Error {
  constructor(message='Teacher or course does not belong to this academy'){
    super(message);this.name='LessonReferenceInvalid';
  }
}
export class LessonNotFound extends Error {
  constructor(){super('Class not found in this workspace');this.name='LessonNotFound';}
}
export class LessonConflict extends Error {
  constructor(message='Class conflicts with availability or another class'){
    super(message);this.name='LessonConflict';
  }
}

export class LessonUseCases {
  constructor(private readonly lessons:LessonRepository,private readonly members:MembershipPort){}
  private async authorize(workspaceId:string,actorId:string):Promise<void>{
    if(!workspaceId||!actorId)throw new LessonAccessDenied();
    const [manager,teacher]=await Promise.all([
      this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN']),
      this.members.hasAnyRole(workspaceId,actorId,['TEACHER']),
    ]);
    if(!manager&&!teacher)throw new LessonAccessDenied();
  }
  async list(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId);
    return this.lessons.list(workspaceId,actorId);
  }
  async create(workspaceId:string,actorId:string,raw:unknown){
    await this.authorize(workspaceId,actorId);
    return this.lessons.create(workspaceId,actorId,parseLessonDraft(raw));
  }
  async cancel(workspaceId:string,actorId:string,raw:unknown){
    await this.authorize(workspaceId,actorId);
    return this.lessons.cancel(workspaceId,actorId,parseLessonId(raw));
  }
}
