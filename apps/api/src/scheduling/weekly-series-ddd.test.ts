import test from 'node:test';
import assert from 'node:assert/strict';
import {InvalidWeeklySeries,planWeeklySeries} from '../modules/scheduling/domain/weekly-series.js';
import {CreateWeeklySeriesUseCase,WeeklySeriesNotAllowed} from '../modules/scheduling/application/create-weekly-series-use-case.js';
import type {WeeklySeriesRepository,WeeklySeriesTemplate} from '../modules/scheduling/application/weekly-series-ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

const start=new Date('2027-03-07T14:00:00Z'),end=new Date('2027-03-07T15:00:00Z');
const now=new Date('2026-11-22T00:00:00Z');
test('weekly recurring lessons preserve local time across US daylight saving',()=>{
 const result=planWeeklySeries({startsAt:start,endsAt:end},3,'America/New_York',now);
 assert.equal(result.length,3);
 assert.equal(result[0]?.startsAt.toISOString(),'2027-03-07T14:00:00.000Z');
 assert.equal(result[1]?.startsAt.toISOString(),'2027-03-14T13:00:00.000Z');
 assert.equal(result[2]?.startsAt.toISOString(),'2027-03-21T13:00:00.000Z');
});
test('nonexistent local time at DST transition fails rather than shifting the lesson',()=>{
 assert.throws(()=>planWeeklySeries({
  startsAt:new Date('2027-03-07T07:30:00Z'),
  endsAt:new Date('2027-03-07T08:30:00Z'),
 },2,'America/New_York',now),InvalidWeeklySeries);
 assert.throws(()=>planWeeklySeries({startsAt:start,endsAt:end},17,'America/Bogota',now),InvalidWeeklySeries);
 assert.throws(()=>planWeeklySeries({startsAt:start,endsAt:end},1,'America/Bogota',now),InvalidWeeklySeries);
});
test('manager can plan a series; other teachers cannot use another teacher schedule',async()=>{
 const calls:string[]=[];
 const store:WeeklySeriesRepository={
  workspaceTimezone:async()=> 'America/New_York',
  isAssignedTeacher:async(_w,_u,id)=>id==='teacher-1',
  create:async(_w,_actor,draft,lessons,tz)=>{
   calls.push(draft.title);
   return {seriesId:'series-1',count:lessons.length,timeZone:tz,
    lessons:lessons.map((x,i)=>({...x,id:'lesson-'+i,title:draft.title,seriesIndex:i}))};
  },
 };
 const roles=(role:WorkspaceRole):MembershipPort=>({hasAnyRole:async(_w,_u,r)=>r.includes(role)});
 const draft:WeeklySeriesTemplate={
  title:'Algebra',teacherProfileId:'teacher-1',mode:'ONSITE',capacity:5,location:'Sede centro',
  startsAt:start,endsAt:end,repeatWeeks:3,
 };
 const manager=new CreateWeeklySeriesUseCase(store,roles('OWNER'));
 assert.equal((await manager.execute('w','owner',draft)).count,3);
 const teacher=new CreateWeeklySeriesUseCase(store,roles('TEACHER'));
 await teacher.execute('w','teacher',draft);
 await assert.rejects(()=>teacher.execute('w','teacher',{...draft,teacherProfileId:'someone-else'}),WeeklySeriesNotAllowed);
 assert.deepEqual(calls,['Algebra','Algebra']);
});
