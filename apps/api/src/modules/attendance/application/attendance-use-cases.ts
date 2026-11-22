import type {MembershipPort} from '../../academics/application/ports.js';
import type {AttendanceRepository} from './ports.js';
import {parseAttendance,parseBookingId} from '../domain/attendance-policy.js';

export class AttendanceAccessDenied extends Error {
  constructor(){super('You cannot manage attendance in this academy');this.name='AttendanceAccessDenied';}
}
export class ActiveAttendanceBookingNotFound extends Error {
  constructor(){super('Active booking not found');this.name='ActiveAttendanceBookingNotFound';}
}
export class AttendanceChangedConflict extends Error {
  constructor(){super('Booking or class status changed; refresh and retry');this.name='AttendanceChangedConflict';}
}

export class AttendanceUseCases {
  constructor(private readonly repository:AttendanceRepository,private readonly members:MembershipPort){}

  private async permissions(workspaceId:string,actorId:string):Promise<{isManager:boolean}> {
    if(!workspaceId||!actorId)throw new AttendanceAccessDenied();
    const [isManager,isTeacher]=await Promise.all([
      this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN']),
      this.members.hasAnyRole(workspaceId,actorId,['TEACHER']),
    ]);
    if(!isManager&&!isTeacher)throw new AttendanceAccessDenied();
    return {isManager};
  }

  async listStaff(workspaceId:string,actorId:string) {
    const {isManager}=await this.permissions(workspaceId,actorId);
    return this.repository.listStaff(workspaceId,actorId,isManager);
  }

  async mark(workspaceId:string,actorId:string,bookingId:unknown,raw:unknown) {
    const {isManager}=await this.permissions(workspaceId,actorId);
    const id=parseBookingId(bookingId);
    const attendance=parseAttendance(raw);
    return this.repository.mark(workspaceId,actorId,isManager,id,attendance);
  }
}
