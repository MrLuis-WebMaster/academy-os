import type {AttendanceStatus} from '../domain/attendance-policy.js';

export interface StaffAttendanceRow {
  id:string;
  sessionId:string;
  attendance:AttendanceStatus|null;
  bookedAt:Date;
  student:{name:string};
  session:{title:string;startsAt:Date};
}
export interface MarkedAttendance {id:string;attendance:AttendanceStatus}

export interface AttendanceRepository {
  listStaff(workspaceId:string,actorId:string,isManager:boolean):Promise<StaffAttendanceRow[]>;
  /** Must re-check membership, booking state, session ownership and cancellation atomically. */
  mark(workspaceId:string,actorId:string,isManager:boolean,bookingId:string,attendance:AttendanceStatus):Promise<MarkedAttendance>;
}
