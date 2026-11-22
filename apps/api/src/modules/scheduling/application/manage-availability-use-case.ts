import type {MembershipPort} from '../../academics/application/ports.js';
import {parseWeeklySlot} from '../domain/weekly-availability.js';
import type {AvailabilityRepository} from './availability-ports.js';

export class AvailabilityPermissionDenied extends Error {
  constructor(){super('Only academy owners and administrators can edit weekly availability');this.name='AvailabilityPermissionDenied';}
}
export class AvailabilityConflict extends Error {
  constructor(message='Weekly availability overlaps an existing slot'){super(message);this.name='AvailabilityConflict';}
}
export class AvailabilityInvalidTeacher extends Error {
  constructor(){super('Teacher does not belong to this academy');this.name='AvailabilityInvalidTeacher';}
}
export class AvailabilitySlotNotFound extends Error {
  constructor(){super('Availability slot not found');this.name='AvailabilitySlotNotFound';}
}
export class ManageAvailabilityUseCase {
  constructor(private readonly repository:AvailabilityRepository,private readonly memberships:MembershipPort){}
  private async allow(workspaceId:string,userId:string){
    if(!workspaceId||!userId||!await this.memberships.hasAnyRole(workspaceId,userId,['OWNER','ADMIN']))throw new AvailabilityPermissionDenied();
  }
  async list(workspaceId:string,userId:string){
    await this.allow(workspaceId,userId);
    return this.repository.list(workspaceId);
  }
  async add(workspaceId:string,userId:string,input:unknown){
    await this.allow(workspaceId,userId);
    const source=input as Record<string,unknown>|null;
    const teacherId=source&&typeof source.teacherProfileId==='string'?source.teacherProfileId:'';
    if(!teacherId||!await this.repository.teacherInWorkspace(workspaceId,teacherId))throw new AvailabilityInvalidTeacher();
    const slot=parseWeeklySlot(input);
    return this.repository.add(workspaceId,teacherId,slot);
  }
  async remove(workspaceId:string,userId:string,id:string){
    await this.allow(workspaceId,userId);
    if(!await this.repository.remove(workspaceId,id))throw new AvailabilitySlotNotFound();
    return {id,deleted:true};
  }
}
