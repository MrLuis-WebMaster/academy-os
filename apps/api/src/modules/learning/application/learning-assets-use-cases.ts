import type {MembershipPort} from '../../academics/application/ports.js';
import {parseLearningAsset,parseLearningAssetId} from '../domain/learning-asset.js';
import type {LearningAssetsRepository} from './learning-assets-ports.js';

export class LearningAssetDenied extends Error{
 constructor(){super('You cannot access this Class Alive resource');this.name='LearningAssetDenied';}
}
export class LearningAssetNotFound extends Error{
 constructor(){super('Lesson, resource or approved notes are not available');this.name='LearningAssetNotFound';}
}
export class LearningAssetConflict extends Error{
 constructor(message='Only an unpublished resource can be revised; publish class notes first'){
  super(message);this.name='LearningAssetConflict';
 }
}
export class LearningAssetsUseCases{
 constructor(private readonly assets:LearningAssetsRepository,private readonly members:MembershipPort){}
 private async authorize(workspaceId:string,actorId:string,student:boolean){
  if(!workspaceId||!actorId||!await this.members.hasAnyRole(
   workspaceId,actorId,student?['STUDENT']:['OWNER','ADMIN','TEACHER'],
  ))throw new LearningAssetDenied();
 }
 async create(workspaceId:string,actorId:string,raw:unknown){
  await this.authorize(workspaceId,actorId,false);
  return this.assets.create(workspaceId,actorId,parseLearningAsset(raw));
 }
 async staff(workspaceId:string,actorId:string){
  await this.authorize(workspaceId,actorId,false);
  return this.assets.staff(workspaceId,actorId);
 }
 async revise(workspaceId:string,actorId:string,id:unknown,raw:unknown){
  await this.authorize(workspaceId,actorId,false);
  return this.assets.revise(workspaceId,actorId,parseLearningAssetId(id),raw);
 }
 async publish(workspaceId:string,actorId:string,id:unknown){
  await this.authorize(workspaceId,actorId,false);
  return this.assets.publish(workspaceId,actorId,parseLearningAssetId(id));
 }
 async student(workspaceId:string,actorId:string){
  await this.authorize(workspaceId,actorId,true);
  return this.assets.student(workspaceId,actorId);
 }
}
