import {z} from 'zod';

export const attendanceInput=z.object({
  attendance:z.enum(['PRESENT','ABSENT','LATE','EXCUSED']),
});
export type AttendanceStatus=z.infer<typeof attendanceInput>['attendance'];

export class InvalidAttendanceInput extends Error {
  constructor(readonly details:unknown){super('Invalid attendance input');this.name='InvalidAttendanceInput';}
}
export class AttendanceTeacherMismatch extends Error {
  constructor(){super('Only the assigned teacher can mark attendance');this.name='AttendanceTeacherMismatch';}
}
export class AttendanceClassCancelled extends Error {
  constructor(){super('Class was cancelled');this.name='AttendanceClassCancelled';}
}

export function parseAttendance(raw:unknown):AttendanceStatus {
  const parsed=attendanceInput.safeParse(raw);
  if(!parsed.success)throw new InvalidAttendanceInput(parsed.error.flatten());
  return parsed.data.attendance;
}
export function parseBookingId(raw:unknown):string {
  if(typeof raw!=='string'||!raw.trim()||raw.length>128){
    throw new InvalidAttendanceInput('A valid booking identifier is required');
  }
  return raw.trim();
}
/** A teacher may only mark their own students; a manager can mark any class in their academy. */
export function ensureMayMarkAttendance(
  sessionStatus:'DRAFT'|'CONFIRMED'|'COMPLETED'|'CANCELLED',
  assignedTeacherUserId:string|null,
  actorId:string,
  isManager:boolean,
):void {
  if(!isManager&&assignedTeacherUserId!==actorId)throw new AttendanceTeacherMismatch();
  if(sessionStatus==='CANCELLED')throw new AttendanceClassCancelled();
}
