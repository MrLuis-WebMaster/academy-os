import type {MembershipPort} from '../../academics/application/ports.js';
import {parsePrivateMaterial,privateMaterialId,filePublication,PrivateMaterialDenied,PrivateMaterialDisabled} from '../domain/private-material.js';
import type {PrivateMaterialRepository} from './private-material-ports.js';
export class PrivateMaterialUseCases{
 constructor(private readonly repo:PrivateMaterialRepository,private readonly members:MembershipPort,private readonly uploadsEnabled:boolean){}
 private async staff(workspaceId:string,userId:string){
  if(!await this.members.hasAnyRole(workspaceId,userId,['OWNER','ADMIN','TEACHER']))throw new PrivateMaterialDenied('Material management is restricted');
 }
 async list(workspaceId:string,userId:string){
  await this.staff(workspaceId,userId);return {uploadsEnabled:this.uploadsEnabled,files:await this.repo.list(workspaceId,userId)};
 }
 async create(workspaceId:string,userId:string,raw:unknown,file:unknown){
  await this.staff(workspaceId,userId);
  if(!this.uploadsEnabled)throw new PrivateMaterialDisabled('Private file uploads are disabled');
  return this.repo.create(workspaceId,userId,parsePrivateMaterial(raw,file));
 }
 async publish(workspaceId:string,userId:string,id:unknown,raw:unknown){
  await this.staff(workspaceId,userId);
  const published=filePublication(raw);
  if(published&&!this.uploadsEnabled)throw new PrivateMaterialDisabled('Private file publication is disabled');
  return this.repo.setPublished(workspaceId,userId,privateMaterialId(id),published);
 }
 async remove(workspaceId:string,userId:string,id:unknown){
  await this.staff(workspaceId,userId);await this.repo.remove(workspaceId,userId,privateMaterialId(id));return {removed:true};
 }
 async download(workspaceId:string,userId:string,id:unknown){
  return this.repo.download(workspaceId,userId,privateMaterialId(id));
 }
}
