import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {SeriesBookingRepository} from '../modules/scheduling/application/series-booking-ports.js';
import {SeriesBookingUseCases,SeriesBookingAccessDenied} from '../modules/scheduling/application/series-booking-use-cases.js';
import {InvalidSeriesIdentifier} from '../modules/scheduling/domain/series-cancellation.js';

test('bulk series booking rejects students from another academy and unrelated roles',async()=>{
 const calls:string[]=[];
 const membership:MembershipPort={
  hasAnyRole:async(workspace,actor,roles:readonly WorkspaceRole[])=>
   workspace==='a'&&actor==='student'&&roles.includes('STUDENT'),
 };
 const repository:SeriesBookingRepository={
  reserveFuture:async()=>{calls.push('reserve');return {seriesId:'s',total:2,booked:2,alreadyBooked:0,inAppNotificationsCreated:2};},
  cancelFuture:async()=>{calls.push('cancel');return {seriesId:'s',cancelledBookings:2};},
 };
 const app=new SeriesBookingUseCases(repository,membership);
 await assert.rejects(app.reserve('b','student','s'),SeriesBookingAccessDenied);
 await assert.rejects(app.cancelFuture('a','teacher','s'),SeriesBookingAccessDenied);
 await assert.rejects(app.reserve('a','student',''),InvalidSeriesIdentifier);
 assert.deepEqual(calls,[]);
 assert.equal((await app.reserve('a','student','s')).booked,2);
 assert.equal((await app.cancelFuture('a','student','s')).cancelledBookings,2);
 assert.deepEqual(calls,['reserve','cancel']);
});
