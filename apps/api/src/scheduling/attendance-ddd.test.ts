import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {AttendanceRepository} from '../modules/attendance/application/ports.js';
import {
  AttendanceAccessDenied,AttendanceUseCases,
} from '../modules/attendance/application/attendance-use-cases.js';
import {
  AttendanceClassCancelled,AttendanceTeacherMismatch,InvalidAttendanceInput,
  ensureMayMarkAttendance,
} from '../modules/attendance/domain/attendance-policy.js';

const input={attendance:'LATE' as const};
function fixture(){
  const calls:Array<{workspace:string;actor:string;manager:boolean;booking:string;attendance:string}>=[];
  const members:MembershipPort={
    hasAnyRole:async(workspace,actor,roles:readonly WorkspaceRole[])=>{
      const actorRole=actor==='owner'?'OWNER':actor==='admin'?'ADMIN':actor==='teacher'?'TEACHER':'STUDENT';
      return workspace==='academy-a'&&roles.includes(actorRole);
    },
  };
  const repository:AttendanceRepository={
    listStaff:async()=>[],
    mark:async(workspace,actor,manager,booking,attendance)=>{
      calls.push({workspace,actor,manager,booking,attendance});
      return {id:booking,attendance};
    },
  };
  return {attendance:new AttendanceUseCases(repository,members),calls};
}

test('students and members of other academies cannot inspect or mark attendance',async()=>{
  const {attendance,calls}=fixture();
  await assert.rejects(attendance.listStaff('academy-a','student'),AttendanceAccessDenied);
  await assert.rejects(attendance.listStaff('academy-b','owner'),AttendanceAccessDenied);
  await assert.rejects(attendance.mark('academy-a','student','booking-a',input),AttendanceAccessDenied);
  assert.equal(calls.length,0);
});

test('teachers are scoped while owners/admins can manage academy-wide attendance',async()=>{
  const {attendance,calls}=fixture();
  await attendance.mark('academy-a','teacher','booking-a',input);
  await attendance.mark('academy-a','owner','booking-b',{attendance:'PRESENT'});
  await attendance.mark('academy-a','admin','booking-c',{attendance:'EXCUSED'});
  assert.deepEqual(calls.map(call=>[call.actor,call.manager,call.attendance]),[
    ['teacher',false,'LATE'],['owner',true,'PRESENT'],['admin',true,'EXCUSED'],
  ]);
});

test('invalid status and booking identifiers are rejected before repository writes',async()=>{
  const {attendance,calls}=fixture();
  await assert.rejects(attendance.mark('academy-a','teacher','booking-a',{attendance:'UNKNOWN'}),InvalidAttendanceInput);
  await assert.rejects(attendance.mark('academy-a','owner','',{attendance:'PRESENT'}),InvalidAttendanceInput);
  assert.equal(calls.length,0);
});

test('attendance policy forbids other teachers and cancelled lessons',()=>{
  assert.throws(()=>ensureMayMarkAttendance('CONFIRMED','other','teacher',false),AttendanceTeacherMismatch);
  assert.throws(()=>ensureMayMarkAttendance('CANCELLED','teacher','teacher',false),AttendanceClassCancelled);
  assert.doesNotThrow(()=>ensureMayMarkAttendance('COMPLETED','other','owner',true));
  assert.doesNotThrow(()=>ensureMayMarkAttendance('CONFIRMED','teacher','teacher',false));
});
