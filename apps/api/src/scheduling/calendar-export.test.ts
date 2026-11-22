import test from 'node:test';
import assert from 'node:assert/strict';
import {escapeCalendarText,foldCalendarLine,serializeAcademyCalendar} from '../modules/calendar/domain/calendar.js';
import {ExportCalendarUseCase,CalendarAccessDenied} from '../modules/calendar/application/export-calendar-use-case.js';
import type {CalendarReadRepository,CalendarScope} from '../modules/calendar/application/ports.js';

test('ICS escapes newline/commas/semicolons to prevent field injection',()=>{
 const payload='Math,\nBEGIN:VEVENT\nUID:evil; title';
 const safe=escapeCalendarText(payload);
 assert.equal(safe,'Math\\,\\nBEGIN:VEVENT\\nUID:evil\\; title');
 const result=serializeAcademyCalendar([{
  id:'lesson-1',title:payload,
  startsAt:new Date('2026-12-04T18:00:00.000Z'),
  endsAt:new Date('2026-12-04T19:00:00.000Z'),
  status:'CONFIRMED',location:'Aula, 3',meetingUrl:'https://meet.example.invalid/a',changes:2,
 }],new Date('2026-11-22T00:00:00.000Z'));
 assert.match(result,/DTSTART:20261204T180000Z/);
 assert.match(result,/SEQUENCE:2/);
 assert.match(result,/LOCATION:Aula\\, 3/);
 assert.equal((result.match(/BEGIN:VEVENT/g)||[]).length,1);
 assert.ok(result.endsWith('\r\n'));
});
test('ICS folds long UTF-8 strings and preserves octet line limits',()=>{
 const text=foldCalendarLine('SUMMARY:'+'🎓'.repeat(60));
 const encoder=new TextEncoder();
 for(const row of text.split('\r\n'))assert.ok(encoder.encode(row).length<=75);
});
test('download calendar is limited to the right teacher/student scope',async()=>{
 const scopes:CalendarScope[]=[];
 const repo=(roles:string[]):CalendarReadRepository=>({
  memberships:async()=>roles,
  lessons:async(_w,_u,scope)=>{scopes.push(scope);return[];},
 });
 await new ExportCalendarUseCase(repo(['OWNER'])).execute('w','u');
 await new ExportCalendarUseCase(repo(['TEACHER'])).execute('w','u');
 await new ExportCalendarUseCase(repo(['STUDENT'])).execute('w','u');
 assert.deepEqual(scopes,['ALL','TEACHER','STUDENT']);
 await assert.rejects(()=>new ExportCalendarUseCase(repo(['GUARDIAN'])).execute('w','u'),CalendarAccessDenied);
 await assert.rejects(()=>new ExportCalendarUseCase(repo([])).execute('w','u'),CalendarAccessDenied);
});
