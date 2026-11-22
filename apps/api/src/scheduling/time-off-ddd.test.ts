import test from 'node:test';
import assert from 'node:assert/strict';
import {InvalidTimeOffWindow,parseTimeOffWindow,intervalsOverlap} from '../modules/scheduling/domain/time-off.js';
import {ManageTimeOffUseCase,TimeOffPermissionDenied,TimeOffTeacherUnknown,TimeOffNotFound} from '../modules/scheduling/application/manage-time-off-use-case.js';
import type {TeacherTimeOffRepository} from '../modules/scheduling/application/time-off-ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

const now=new Date('2026-11-01T00:00:00Z');
const request={teacherProfileId:'teacher1',startsAt:'2026-12-01T08:00:00-05:00',endsAt:'2026-12-02T08:00:00-05:00',reason:'Cita médica'};
test('time off must be future, timezone-aware and reasoned',()=>{
 const parsed=parseTimeOffWindow(request,now);
 assert.equal(parsed.reason,'Cita médica');
 assert.throws(()=>parseTimeOffWindow({...request,startsAt:'2026-10-01T08:00:00-05:00'},now),InvalidTimeOffWindow);
 assert.throws(()=>parseTimeOffWindow({...request,reason:'x'},now),InvalidTimeOffWindow);
 assert.throws(()=>parseTimeOffWindow({...request,startsAt:'2026-12-01T08:00:00'},now),InvalidTimeOffWindow);
 assert.equal(intervalsOverlap(
  {startsAt:new Date('2026-12-01T12:00:00Z'),endsAt:new Date('2026-12-01T13:00:00Z')},
  {startsAt:new Date('2026-12-01T13:00:00Z'),endsAt:new Date('2026-12-01T14:00:00Z')}
 ),false);
});
test('manager can add any teacher absence; teachers only their own',async()=>{
 const records:Array<{id:string;teacherProfileId:string}>=[];
 const repository:TeacherTimeOffRepository={
  teacherForUser:async()=> 'teacher1',
  belongsToWorkspace:async(_w,id)=>id==='teacher1'||id==='teacher2',
  list:async()=>[],
  create:async(w,t,a,window)=>{
   records.push({id:'t'+records.length,teacherProfileId:t});
   return {id:'t'+records.length,workspaceId:w,teacherProfileId:t,createdAt:new Date(),...window};
  },
  remove:async(_w,id,teacherId)=>Boolean(records.find(r=>r.id===id && (!teacherId||r.teacherProfileId===teacherId))),
 };
 const member=(role:WorkspaceRole):MembershipPort=>({hasAnyRole:async(_w,_u,roles)=>roles.includes(role)});
 const admin=new ManageTimeOffUseCase(repository,member('ADMIN'));
 const teacher=new ManageTimeOffUseCase(repository,member('TEACHER'));
 const student=new ManageTimeOffUseCase(repository,member('STUDENT'));
 await admin.create('w','admin','teacher2',request);
 await teacher.create('w','teacher','teacher1',request);
 assert.equal(records.length,2);
 await assert.rejects(()=>teacher.create('w','teacher','teacher2',request),TimeOffTeacherUnknown);
 await assert.rejects(()=>student.list('w','student'),TimeOffPermissionDenied);
 await assert.rejects(()=>teacher.remove('w','teacher','not-found'),TimeOffNotFound);
});
