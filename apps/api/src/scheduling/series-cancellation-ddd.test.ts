import test from 'node:test';
import assert from 'node:assert/strict';
import {futureConfirmedOccurrences,parseSeriesId,InvalidSeriesIdentifier} from '../modules/scheduling/domain/series-cancellation.js';
import {CancelFutureSeriesUseCase,SeriesCancellationDenied} from '../modules/scheduling/application/cancel-future-series-use-case.js';
import type {WeeklySeriesCancellationRepository} from '../modules/scheduling/application/series-cancellation-ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

test('only future confirmed lessons are cancellable; history remains',()=>{
 const now=new Date('2027-01-01T00:00:00Z');
 assert.deepEqual(futureConfirmedOccurrences([
  {id:'past',status:'CONFIRMED',startsAt:new Date('2026-12-01T00:00:00Z')},
  {id:'future',status:'CONFIRMED',startsAt:new Date('2027-02-01T00:00:00Z')},
  {id:'done',status:'COMPLETED',startsAt:new Date('2027-02-02T00:00:00Z')},
  {id:'cancelled',status:'CANCELLED',startsAt:new Date('2027-02-03T00:00:00Z')},
 ],now),['future']);
 assert.throws(()=>parseSeriesId(' '),InvalidSeriesIdentifier);
});
test('cancel future requires a manager or the series assigned teacher',async()=>{
 const called:string[]=[];
 const store:WeeklySeriesCancellationRepository={
  belongsToAssignedTeacher:async(_w,_u,id)=>id==='own-series',
  cancelFuture:async(_w,id)=>{
   called.push(id);
   return {seriesId:id,cancelledSessions:2,notifiedStudents:1,historicalSessionsPreserved:true};
  },
 };
 const member=(role:WorkspaceRole):MembershipPort=>({hasAnyRole:async(_w,_u,roles)=>roles.includes(role)});
 const owner=new CancelFutureSeriesUseCase(store,member('OWNER'));
 const teacher=new CancelFutureSeriesUseCase(store,member('TEACHER'));
 const student=new CancelFutureSeriesUseCase(store,member('STUDENT'));
 const receipt=await owner.execute('w','owner','series-1');
 assert.equal(receipt.cancelledSessions,2);
 await teacher.execute('w','teacher','own-series');
 await assert.rejects(()=>teacher.execute('w','teacher','not-mine'),SeriesCancellationDenied);
 await assert.rejects(()=>student.execute('w','student','own-series'),SeriesCancellationDenied);
 assert.deepEqual(called,['series-1','own-series']);
});
