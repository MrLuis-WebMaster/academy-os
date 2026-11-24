import test from 'node:test';
import assert from 'node:assert/strict';
import {ExportClassToCalendar} from '../modules/integrations/application/calendar-use-cases.js';
import type {CalendarExportRepository,CalendarExportSnapshot,CalendarEventPort} from '../modules/integrations/application/calendar-ports.js';
import {OAuthCrypto} from '../modules/integrations/infrastructure/oauth-crypto.js';
import {CalendarSyncConflict} from '../modules/integrations/domain/calendar-event.js';
import {CALENDAR_SCOPE,IntegrationDenied} from '../modules/integrations/domain/google-connection.js';

function fixture(){
 const crypto=new OAuthCrypto(Buffer.alloc(32,52));
 const snapshot:CalendarExportSnapshot={
  connectionId:'connection',connectedAt:new Date(),encryptedCredentials:crypto.seal(JSON.stringify({
   accessToken:'access',refreshToken:'refresh',expiresAt:Date.now()+3600_000,scope:CALENDAR_SCOPE,
  }),JSON.stringify(['google-calendar-token','a','teacher'])),
  lesson:{id:'class',title:'Class',startsAt:new Date(Date.now()+3600_000),endsAt:new Date(Date.now()+7200_000),
   status:'CONFIRMED',mode:'ONLINE',timezone:'America/Bogota',meetingUrl:'https://example.test/manual',provider:'CUSTOM'},
 };
 let published=0,accept=true,link:string|null='https://meet.google.com/abc-defg-hij',calls=0;
 const repo:CalendarExportRepository={
  snapshot:async(w,u,s)=>w==='a'&&u==='teacher'&&s==='class'?snapshot:null,
  publishMeet:async(w,u,old,url)=>{
   assert.equal(w,'a');assert.equal(u,'teacher');assert.equal(old.lesson.meetingUrl,'https://example.test/manual');
   assert.equal(url,'https://meet.google.com/abc-defg-hij');published++;return accept;
  },
  autoSyncStatus:async()=>({enabled:false,pending:false,lastErrorCode:null}),
  setAutoSync:async()=>true,
  replaceCredential:async()=>true,
 };
 const provider:CalendarEventPort={
  configured:()=>true,
  refresh:async(c)=>c,
  sync:async()=>{calls++;return {state:'saved',meetUrl:link,conferencePending:!link};},
 };
 return {snapshot,app:new ExportClassToCalendar(repo,provider,crypto),count:()=>published,
  calls:()=>calls,rejectPublication:()=>{accept=false;},setLink:(v:string|null)=>{link=v;}};
}
test('Meet remains unpublished unless explicitly requested',async()=>{
 const f=fixture();
 assert.equal((await f.app.execute('a','teacher','class',{createMeet:true})).meetPublished,false);
 assert.equal(f.count(),0);
 assert.equal((await f.app.execute('a','teacher','class',{createMeet:true,publishMeet:true})).meetPublished,true);
 assert.equal(f.count(),1);
});
test('pending or unsafe link is never published',async()=>{
 const f=fixture();
 for(const link of [null,'https://meet.google.com.attacker.test/abc']){
  f.setLink(link);
  assert.equal((await f.app.execute('a','teacher','class',{createMeet:true,publishMeet:true})).meetPublished,false);
 }
 assert.equal(f.count(),0);
});
test('rejects cross-academy and invalid publication before provider call',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.app.execute('other','teacher','class',{createMeet:true,publishMeet:true}),IntegrationDenied);
 await assert.rejects(()=>f.app.execute('a','teacher','class',{createMeet:false,publishMeet:true}),CalendarSyncConflict);
 f.snapshot.lesson.status='CANCELLED';
 await assert.rejects(()=>f.app.execute('a','teacher','class',{createMeet:true,publishMeet:true}),CalendarSyncConflict);
 assert.equal(f.calls(),0);
});
test('reports conflict when the class or connection changed during external request',async()=>{
 const f=fixture();f.rejectPublication();
 await assert.rejects(()=>f.app.execute('a','teacher','class',{createMeet:true,publishMeet:true}),CalendarSyncConflict);
});
