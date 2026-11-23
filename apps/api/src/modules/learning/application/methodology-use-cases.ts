import type {MembershipPort} from '../../academics/application/ports.js';
import {parseTeachingMethodology,parseTeacherProfileId} from '../domain/teaching-methodology.js';
import type {TeacherMethodologyRepository} from './methodology-ports.js';

export class MethodologyAccessDenied extends Error{
 constructor(){super('You can only configure your own teaching method or manage your academy');this.name='MethodologyAccessDenied';}
}
export class MethodologyNotFound extends Error{
 constructor(){super('Teacher is not part of this academy');this.name='MethodologyNotFound';}
}
export class TeacherMethodologyUseCases{
 constructor(private readonly repo:TeacherMethodologyRepository,private readonly members:MembershipPort){}
 private async authorize(workspaceId:string,actorId:string){
  if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN','TEACHER'])){
   throw new MethodologyAccessDenied();
  }
 }
 async read(workspaceId:string,actorId:string,profileId:unknown){
  await this.authorize(workspaceId,actorId);
  return this.repo.read(workspaceId,actorId,parseTeacherProfileId(profileId));
 }
 async save(workspaceId:string,actorId:string,profileId:unknown,raw:unknown){
  await this.authorize(workspaceId,actorId);
  return this.repo.save(workspaceId,actorId,parseTeacherProfileId(profileId),parseTeachingMethodology(raw));
 }
}
