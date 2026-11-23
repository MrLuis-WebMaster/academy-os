import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {HolidayPolicyRepository} from '../modules/scheduling/application/holiday-policy-ports.js';
import {HolidayPolicyUseCases,HolidayPolicyAccessDenied} from '../modules/scheduling/application/holiday-policy-use-cases.js';

function fixture(){
 const calls:string[]=[];
 const membership:MembershipPort={
  hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>
   w==='academy'&&roles.includes(u==='manager'?'OWNER':u==='teacher'?'TEACHER':'STUDENT'),
 };
 const repository:HolidayPolicyRepository={
  read:async()=>{calls.push('read');return {timezone:'America/Bogota',holidayCountry:'CO',avoidPublicHolidays:false};},
  update:async(_w,_u,patch)=>{calls.push('update');return {
   timezone:'America/Bogota',holidayCountry:patch.holidayCountry??'CO',
   avoidPublicHolidays:patch.avoidPublicHolidays??false,
  };},
 };
 return {app:new HolidayPolicyUseCases(repository,membership),calls};
}
test('only managers change holiday scheduling policy',async()=>{
 const {app,calls}=fixture();
 await assert.rejects(app.update('academy','teacher',{avoidPublicHolidays:true}),HolidayPolicyAccessDenied);
 await assert.rejects(app.read('other','manager'),HolidayPolicyAccessDenied);
 await app.read('academy','teacher');
 const result=await app.update('academy','manager',{avoidPublicHolidays:true});
 assert.equal(result.avoidPublicHolidays,true);
 assert.deepEqual(calls,['read','update']);
});
test('academy members can read holidays for a year but not another tenant',async()=>{
 const {app}=fixture();
 const calendar=await app.calendar('academy','teacher','2026');
 assert.equal(calendar.holidays.find(h=>h.name.includes('Chiquinquirá'))?.date,'2026-07-13');
 await assert.rejects(app.calendar('other','manager','2026'),HolidayPolicyAccessDenied);
});
