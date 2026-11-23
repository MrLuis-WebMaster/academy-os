import test from 'node:test';
import assert from 'node:assert/strict';
import {InvalidSeriesEdit,parseFutureSeriesEdit,planEditedFutureSeries} from '../modules/scheduling/domain/series-edit.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import {EditFutureSeriesUseCase,SeriesEditDenied} from '../modules/scheduling/application/edit-future-series.js';
import type {SeriesEditRepository} from '../modules/scheduling/application/edit-future-series.js';

test('future edits must be meaningful and provide paired date/time updates',()=>{
 assert.throws(()=>parseFutureSeriesEdit({reason:'Schedule updated'}),InvalidSeriesEdit);
 assert.throws(()=>parseFutureSeriesEdit({reason:'Schedule updated',startsAt:'2026-12-20T09:00:00-05:00'}),InvalidSeriesEdit);
 assert.throws(()=>parseFutureSeriesEdit({reason:'Schedule updated',capacity:0}),InvalidSeriesEdit);
 assert.equal(parseFutureSeriesEdit({reason:'Change room',location:'Room 302'}).location,'Room 302');
});
test('edited series preserves weekly local wall-clock time across DST changes',()=>{
 const oldStart=new Date('2027-03-07T14:00:00Z');
 const ids=[0,1,2].map(index=>({
  id:String(index),seriesIndex:index+3,
  startsAt:new Date(oldStart.getTime()+index*7*86400000),
  endsAt:new Date(oldStart.getTime()+index*7*86400000+3600000),
 }));
 const result=planEditedFutureSeries(ids,{
  startsAt:new Date('2027-03-07T15:00:00Z'),
  endsAt:new Date('2027-03-07T16:00:00Z'),
 },'America/New_York',new Date('2027-01-01T00:00:00Z'));
 assert.equal(result.get('0')?.startsAt.toISOString(),'2027-03-07T15:00:00.000Z');
 assert.equal(result.get('1')?.startsAt.toISOString(),'2027-03-14T14:00:00.000Z');
 assert.equal(result.get('2')?.startsAt.toISOString(),'2027-03-21T14:00:00.000Z');
});
test('students and managers from another academy cannot edit a weekly series',async()=>{
 const member:MembershipPort={
  hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>w==='a'&&u==='owner'&&roles.includes('OWNER'),
 };
 let called=false;
 const repository:SeriesEditRepository={
  editFuture:async()=>{called=true;return {
   seriesId:'series',updatedSessions:2,affectedBookings:0,inAppNotificationsCreated:0,historicalSessionsPreserved:true,
  };},
 };
 const app=new EditFutureSeriesUseCase(repository,member);
 await assert.rejects(app.execute('a','student','series',{reason:'Update group',title:'New title'}),SeriesEditDenied);
 await assert.rejects(app.execute('b','owner','series',{reason:'Update group',title:'New title'}),SeriesEditDenied);
 assert.equal(called,false);
 const response=await app.execute('a','owner','series',{reason:'Update group',title:'New title'});
 assert.equal(response.updatedSessions,2);
});
