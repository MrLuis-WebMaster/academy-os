import type {MembershipPort} from '../../academics/application/ports.js';
import {parseReflectionNotes,parseReflectionSessionId} from '../domain/class-reflection.js';
import type {ReflectionRepository} from './reflection-ports.js';

export class ReflectionAccessDenied extends Error {
  constructor(){super('You cannot access class reflections in this academy');this.name='ReflectionAccessDenied';}
}
export class ReflectionNotFound extends Error {
  constructor(){super('Class not found');this.name='ReflectionNotFound';}
}
export class ReflectionNoCourse extends Error {
  constructor(){super('Class Alive requires a class associated with a course');this.name='ReflectionNoCourse';}
}
export class ReflectionTeacherMismatch extends Error {
  constructor(){super('Only the assigned teacher can edit this class');this.name='ReflectionTeacherMismatch';}
}
export class ReflectionConflict extends Error {
  constructor(message='Save a draft note before publishing or refresh this class'){
    super(message);this.name='ReflectionConflict';
  }
}
export class ReflectionUseCases {
  constructor(private readonly notes:ReflectionRepository,private readonly membership:MembershipPort){}
  private async authorize(workspaceId:string,userId:string,roles:readonly ('OWNER'|'ADMIN'|'TEACHER'|'STUDENT')[]){
    if(!workspaceId||!userId||!await this.membership.hasAnyRole(workspaceId,userId,roles)){
      throw new ReflectionAccessDenied();
    }
  }
  async listStaff(workspaceId:string,userId:string){
    await this.authorize(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    return this.notes.listStaff(workspaceId,userId);
  }
  async listStudent(workspaceId:string,userId:string){
    await this.authorize(workspaceId,userId,['STUDENT']);
    return this.notes.listStudent(workspaceId,userId);
  }
  async save(workspaceId:string,userId:string,sessionId:unknown,raw:unknown){
    const id=parseReflectionSessionId(sessionId);
    const notes=parseReflectionNotes(raw);
    await this.authorize(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    return this.notes.save(workspaceId,userId,id,notes);
  }
  async publish(workspaceId:string,userId:string,sessionId:unknown){
    const id=parseReflectionSessionId(sessionId);
    await this.authorize(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    return this.notes.publish(workspaceId,userId,id);
  }
}
