import test from 'node:test';
import assert from 'node:assert/strict';
import {GoogleCalendarEvents} from '../modules/integrations/infrastructure/google-calendar-events.js';
import {calendarEventBody,CalendarSyncConflict,safeMeetUrl} from '../modules/integrations/domain/calendar-event.js';
import {CALENDAR_SCOPE} from '../modules/integrations/domain/google-connection.js';

const id='a'.repeat(64);
const config={clientId:'mock',clientSecret:'mock',redirectUri:'https://academy.test/callback',enabled:true};
const lesson={id:'class-1',title:'English B1',startsAt:new Date('2026-11-23T18:00:00Z'),endsAt:new Date('2026-11-23T19:00:00Z'),timezone:'America/Bogota',status:'CONFIRMED',mode:'ONLINE'};
const existing={extendedProperties:{private:{academyOS:id}},status:'confirmed'};
test('exports only private title and interval; no participant metadata',()=>{
 const body=calendarEventBody(id,lesson);
 assert.equal(body.visibility,'private');
 assert.equal(body.summary,'English B1');
 assert.ok(!('attendees' in body));
 assert.ok(!('description' in body));
});
test('create uses deterministic id, no invites, optional Meet; update uses same id',async()=>{
 const calls:Array<{url:string;method:string;body:Record<string,unknown>|null}>=[];
 let inserted=false;
 const calendar=new GoogleCalendarEvents(config,async(input,init)=>{
  const method=init?.method??'GET';
  calls.push({url:String(input),method,body:init?.body?JSON.parse(String(init.body)):null});
  if(method==='GET')return inserted?new Response(JSON.stringify({...existing,hangoutLink:'https://meet.google.com/abc-defg-hij'})):new Response('',{status:404});
  inserted=true;
  return new Response(JSON.stringify({...existing,hangoutLink:'https://meet.google.com/abc-defg-hij'}));
 });
 const first=await calendar.sync('fake-token',id,lesson,true);
 assert.equal(first.meetUrl,'https://meet.google.com/abc-defg-hij');
 assert.equal(calls[1]?.method,'POST');
 assert.equal(calls[1]?.body?.id,id);
 assert.ok(calls[1]?.body?.conferenceData);
 assert.ok(calls[1]?.url.includes('sendUpdates=none'));
 await calendar.sync('fake-token',id,{...lesson,title:'Updated'},true);
 assert.equal(calls[3]?.method,'PATCH');
 assert.equal(calls[3]?.body?.conferenceData,undefined);
});
test('cancelled class deletes only matching AcademyOS event',async()=>{
 const methods:string[]=[];
 const calendar=new GoogleCalendarEvents(config,async(_,init)=>{
  methods.push(init?.method??'GET');
  return init?.method==='DELETE'?new Response(null,{status:204}):new Response(JSON.stringify(existing));
 });
 assert.deepEqual(await calendar.sync('token',id,{...lesson,status:'CANCELLED'},false),{state:'removed',meetUrl:null,conferencePending:false});
 assert.deepEqual(methods,['GET','DELETE']);
 const foreign=new GoogleCalendarEvents(config,async()=>new Response(JSON.stringify({status:'confirmed'})));
 await assert.rejects(()=>foreign.sync('token',id,{...lesson,status:'CANCELLED'},false),CalendarSyncConflict);
});
test('refresh retains offline token if not rotated, rejects unsafe Meet links',async()=>{
 const calendar=new GoogleCalendarEvents(config,async()=>new Response(JSON.stringify({access_token:'fresh',expires_in:3600})));
 const result=await calendar.refresh({accessToken:'old',refreshToken:'offline',expiresAt:0,scope:CALENDAR_SCOPE});
 assert.equal(result.refreshToken,'offline');
 assert.equal(result.accessToken,'fresh');
 assert.equal(safeMeetUrl('https://meet.google.com.evil.test/abc'),null);
 assert.equal(safeMeetUrl('https://meet.google.com/abc-defg-hij'),'https://meet.google.com/abc-defg-hij');
});
