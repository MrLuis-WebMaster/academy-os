import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureReservable,ensureCancellable,hasRoom,BookingPolicyViolation} from '../modules/scheduling/domain/booking-policy.js';
import {BookingUseCases,BookingAccessDenied} from '../modules/scheduling/application/booking-use-cases.js';
import type {BookingReservationPort} from '../modules/scheduling/application/booking-ports.js';
import type {MembershipPort} from '../modules/academics/application/ports.js';

test('class reservations reject full, inactive and past sessions',()=>{
 const now=new Date('2026-11-21T00:00:00Z');
 const base={status:'CONFIRMED' as const,capacity:2,occupied:1,startsAt:new Date('2026-12-01T00:00:00Z'),courseId:'c1'};
 assert.equal(hasRoom(2,1),true);
 assert.doesNotThrow(()=>ensureReservable(base,now));
 assert.throws(()=>ensureReservable({...base,occupied:2},now),BookingPolicyViolation);
 assert.throws(()=>ensureReservable({...base,status:'CANCELLED'},now),BookingPolicyViolation);
 assert.throws(()=>ensureReservable({...base,startsAt:now},now),BookingPolicyViolation);
 assert.throws(()=>ensureCancellable(now,now),BookingPolicyViolation);
});
test('student role is checked in application; repository is injectable',async()=>{
 const calls:string[]=[];
 const repo:BookingReservationPort={
  reserve:async(_w,id)=>{calls.push(id);return{id:'b1',sessionId:id,status:'BOOKED',alreadyBooked:false};},
  cancel:async(_w,id)=>{calls.push(id);return{id,status:'CANCELLED'};},
 };
 const members=(allowed:boolean):MembershipPort=>({hasAnyRole:async()=>allowed});
 const student=new BookingUseCases(repo,members(true));
 const stranger=new BookingUseCases(repo,members(false));
 await student.reserve('w1','s1','session1');
 await student.cancel('w1','s1','booking1');
 assert.deepEqual(calls,['session1','booking1']);
 await assert.rejects(()=>stranger.reserve('w1','visitor','session1'),BookingAccessDenied);
 await assert.rejects(()=>student.reserve('w1','s1',null),BookingPolicyViolation);
});
