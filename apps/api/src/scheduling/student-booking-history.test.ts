import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import {
  StudentBookingHistoryUseCase,BookingHistoryAccessDenied,
} from '../modules/scheduling/application/student-booking-history.js';
import type {StudentBookingHistoryRepository} from '../modules/scheduling/application/student-booking-history.js';

test('reservation history cannot be read by staff or another academy',async()=>{
  const calls:string[]=[];
  const member:MembershipPort={
    hasAnyRole:async(workspace,user,roles:readonly WorkspaceRole[])=>
      workspace==='a'&&user==='student'&&roles.includes('STUDENT'),
  };
  const repository:StudentBookingHistoryRepository={
    mine:async(workspace,user)=>{calls.push(workspace+':'+user);return [];}
  };
  const useCase=new StudentBookingHistoryUseCase(repository,member);
  await assert.rejects(useCase.execute('a','teacher'),BookingHistoryAccessDenied);
  await assert.rejects(useCase.execute('b','student'),BookingHistoryAccessDenied);
  assert.equal((await useCase.execute('a','student')).length,0);
  assert.deepEqual(calls,['a:student']);
});
