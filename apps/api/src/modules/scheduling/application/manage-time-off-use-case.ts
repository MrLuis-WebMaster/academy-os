import type {MembershipPort} from '../../academics/application/ports.js';
import type {TeacherTimeOffRepository} from './time-off-ports.js';
import {parseTimeOffWindow} from '../domain/time-off.js';

export class TimeOffPermissionDenied extends Error {
 constructor(){super('Only academy managers and assigned teachers can manage time off');this.name='TimeOffPermissionDenied';}
}
export class TimeOffTeacherUnknown extends Error {
 constructor(){super('Teacher does not belong to this academy');this.name='TimeOffTeacherUnknown';}
}
export class TimeOffConflict extends Error {
 constructor(message='Time off would overlap an already confirmed class'){
  super(message);this.name='TimeOffConflict';
 }
}
export class TimeOffNotFound extends Error {
 constructor(){super('Time-off period not found');this.name='TimeOffNotFound';}
}
export class ManageTimeOffUseCase {
 constructor(private readonly store:TeacherTimeOffRepository,private readonly memberships:MembershipPort){}
 private async scope(workspaceId:string,userId:string):Promise<string|undefined>{
  const manager=await this.memberships.hasAnyRole(workspaceId,userId,['OWNER','ADMIN']);
  if(manager)return undefined;
  if(!await this.memberships.hasAnyRole(workspaceId,userId,['TEACHER']))throw new TimeOffPermissionDenied();
  const teacher=await this.store.teacherForUser(workspaceId,userId);
  if(!teacher)throw new TimeOffPermissionDenied();
  return teacher;
 }
 async list(workspaceId:string,userId:string){
  const mine=await this.scope(workspaceId,userId);
  return this.store.list(workspaceId,mine);
 }
 async create(workspaceId:string,userId:string,teacherProfileId:string,input:unknown){
  const mine=await this.scope(workspaceId,userId);
  if(!teacherProfileId|| (mine&&mine!==teacherProfileId)
   ||!await this.store.belongsToWorkspace(workspaceId,teacherProfileId))throw new TimeOffTeacherUnknown();
  const window=parseTimeOffWindow(input);
  return this.store.create(workspaceId,teacherProfileId,userId,window);
 }
 async remove(workspaceId:string,userId:string,id:string){
  const mine=await this.scope(workspaceId,userId);
  if(!id||!await this.store.remove(workspaceId,id,mine))throw new TimeOffNotFound();
  return {id,removed:true};
 }
}
