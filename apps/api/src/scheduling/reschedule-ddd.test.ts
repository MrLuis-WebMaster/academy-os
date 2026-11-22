import test from 'node:test';
import assert from 'node:assert/strict';
import {InvalidReschedule,planReschedule} from '../modules/scheduling/domain/reschedule.js';
import {RescheduleLessonUseCase,SessionRescheduleDenied} from '../modules/scheduling/application/reschedule-use-case.js';
import type {SessionRescheduleRepository} from '../modules/scheduling/application/ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

const now=new Date('2026-11-01T00:00:00Z');
const move={startsAt:'2026-12-02T14:00:00Z',endsAt:'2026-12-02T15:00:00Z',reason:'Cambio solicitado por el profesor'};
test('reschedule policy validates dates, duration and explanation',()=>{
 const plan=planReschedule(move,now);
 assert.equal(plan.reason,'Cambio solicitado por el profesor');
 assert.throws(()=>planReschedule({...move,startsAt:'2026-10-30T14:00:00Z'},now),InvalidReschedule);
 assert.throws(()=>planReschedule({...move,endsAt:'2026-12-03T04:00:00Z'},now),InvalidReschedule);
 assert.throws(()=>planReschedule({...move,reason:'x'},now),InvalidReschedule);
 assert.throws(()=>planReschedule({...move,endsAt:'2026-12-02T15:00:00'},now),InvalidReschedule);
});
test('only workspace managers or assigned teachers may reschedule',async()=>{
 const calls:string[]=[];
 const repository:SessionRescheduleRepository={
  belongsToTeacher:async(_w,_u,s)=>s==='assigned',
  reschedule:async(_w,s,_actor,plan)=>{
    calls.push(s);
    return {id:s,startsAt:plan.startsAt,endsAt:plan.endsAt,reason:plan.reason,affectedBookings:2,manualNotificationRequired:true};
  },
 };
 const member=(role:WorkspaceRole|null):MembershipPort=>({
   hasAnyRole:async(_w,_u,roles)=>Boolean(role&&roles.includes(role)),
 });
 const admin=new RescheduleLessonUseCase(repository,member('ADMIN'));
 const teacher=new RescheduleLessonUseCase(repository,member('TEACHER'));
 const intruder=new RescheduleLessonUseCase(repository,member('STUDENT'));
 const result=await admin.execute('w','a','session-1',move);
 assert.equal(result.manualNotificationRequired,true);
 await teacher.execute('w','teacher','assigned',move);
 await assert.rejects(()=>teacher.execute('w','teacher','not-assigned',move),SessionRescheduleDenied);
 await assert.rejects(()=>intruder.execute('w','student','assigned',move),SessionRescheduleDenied);
 assert.deepEqual(calls,['session-1','assigned']);
});
