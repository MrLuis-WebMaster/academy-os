import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWeeklySlot,withinWeeklyAvailability,InvalidWeeklySlot} from '../modules/scheduling/domain/weekly-availability.js';
import {ManageAvailabilityUseCase,AvailabilityPermissionDenied,AvailabilityInvalidTeacher} from '../modules/scheduling/application/manage-availability-use-case.js';
import type {AvailabilityRepository} from '../modules/scheduling/application/availability-ports.js';
import type {MembershipPort} from '../modules/academics/application/ports.js';
test('teacher availability validates hours and avoids invalid weekdays',()=>{
 assert.deepEqual(parseWeeklySlot({dayOfWeek:1,startTime:'09:00',endTime:'12:00'}),{dayOfWeek:1,startMinute:540,endMinute:720});
 assert.throws(()=>parseWeeklySlot({dayOfWeek:7,startTime:'09:00',endTime:'12:00'}),InvalidWeeklySlot);
 assert.throws(()=>parseWeeklySlot({dayOfWeek:1,startTime:'11:00',endTime:'10:00'}),InvalidWeeklySlot);
});
test('academy timezone is respected for sessions',()=>{
 const slots=[{dayOfWeek:1,startMinute:540,endMinute:720}];
 // Monday 14:00 UTC is 09:00 in Bogota, inside the weekday morning slot.
 assert.equal(withinWeeklyAvailability(slots,new Date('2026-11-23T14:00:00Z'),new Date('2026-11-23T15:00:00Z'),'America/Bogota'),true);
 assert.equal(withinWeeklyAvailability(slots,new Date('2026-11-23T13:00:00Z'),new Date('2026-11-23T15:00:00Z'),'America/Bogota'),false);
 assert.equal(withinWeeklyAvailability([],new Date('2026-11-23T13:00:00Z'),new Date('2026-11-23T15:00:00Z'),'America/Bogota'),true);
});
test('only managers can configure slots and cannot mix teachers',async()=>{
 const repository:AvailabilityRepository={
  teacherInWorkspace:async(_w,t)=>t==='teacher1',
  list:async()=>[],add:async(w,t,s)=>({id:'a1',workspaceId:w,teacherProfileId:t,...s}),
  remove:async()=>true,
 };
 const authorized:MembershipPort={hasAnyRole:async()=>true};
 const unauthorized:MembershipPort={hasAnyRole:async()=>false};
 const admin=new ManageAvailabilityUseCase(repository,authorized);
 const student=new ManageAvailabilityUseCase(repository,unauthorized);
 const data={teacherProfileId:'teacher1',dayOfWeek:1,startTime:'09:00',endTime:'11:00'};
 assert.equal((await admin.add('w1','owner',data)).id,'a1');
 await assert.rejects(()=>admin.add('w1','owner',{...data,teacherProfileId:'other'}),AvailabilityInvalidTeacher);
 await assert.rejects(()=>student.add('w1','student',data),AvailabilityPermissionDenied);
});
