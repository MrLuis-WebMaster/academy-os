import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsDateRange,parseAnalyticsPeriod,InvalidAnalyticsPeriod} from '../modules/analytics/domain/analytics-period.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {AnalyticsRepository,AnalyticsOverview} from '../modules/analytics/application/analytics-ports.js';
import {AnalyticsUseCases,AnalyticsAccessDenied} from '../modules/analytics/application/analytics-use-cases.js';

test('date ranges are bounded and explicit',()=>{
  assert.equal(parseAnalyticsPeriod(undefined),'30d');
  assert.equal(parseAnalyticsPeriod('7d'),'7d');
  assert.throws(()=>parseAnalyticsPeriod('365d'),InvalidAnalyticsPeriod);
  const {start,end,days}=analyticsDateRange(new Date('2027-01-01T00:00:00Z'),'7d');
  assert.equal(days,7);assert.equal(start.toISOString(),'2026-12-25T00:00:00.000Z');
  assert.equal(end.toISOString(),'2027-01-01T00:00:00.000Z');
});
test('only institutional managers can see aggregate metrics',async()=>{
  const calls:string[]=[];
  const membership:MembershipPort={
    hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>
      w==='a'&&roles.includes(u==='owner'?'OWNER':'STUDENT'),
  };
  const report:AnalyticsOverview={
    period:'30d',from:new Date(),through:new Date(),
    people:{students:1,teachers:1,courses:1},
    classes:{scheduled:1,completed:0,cancelled:0,bookedSeats:1,attendanceRecorded:0},
    learning:{practiceAttempts:0,averagePracticeScore:null,assessedCompetencies:0,activeGoals:0},
    finances:{manualCollectedCOP:0,voidedReceipts:0},notes:[],
  };
  const repository:AnalyticsRepository={
    overview:async()=>{calls.push('overview');return report;},
  };
  const app=new AnalyticsUseCases(repository,membership);
  await assert.rejects(app.overview('a','student','30d'),AnalyticsAccessDenied);
  await assert.rejects(app.overview('b','owner','30d'),AnalyticsAccessDenied);
  assert.deepEqual(calls,[]);
  assert.equal((await app.overview('a','owner','30d')).people.students,1);
});
