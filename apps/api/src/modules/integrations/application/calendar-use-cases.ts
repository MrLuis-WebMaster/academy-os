import type {CalendarExportRepository,CalendarEventPort} from './calendar-ports.js';
import type {IntegrationCryptoPort} from './google-ports.js';
import {CalendarSyncConflict,calendarEventBody} from '../domain/calendar-event.js';
import {IntegrationDenied,IntegrationUnavailable,type GoogleCredential} from '../domain/google-connection.js';
export class ExportClassToCalendar{
 constructor(private readonly repo:CalendarExportRepository,private readonly provider:CalendarEventPort,private readonly crypto:IntegrationCryptoPort){}
 async execute(workspaceId:string,userId:string,sessionId:string,raw:unknown){
  if(!raw||typeof raw!=='object'||typeof (raw as Record<string,unknown>).createMeet!=='boolean')
   throw new CalendarSyncConflict('Explicit conference preference required');
  if(!this.provider.configured())throw new IntegrationUnavailable('Google Calendar integration is disabled');
  const snapshot=await this.repo.snapshot(workspaceId,userId,sessionId);
  if(!snapshot)throw new IntegrationDenied('No authorized connection or class found');
  const eventId=this.crypto.digest(JSON.stringify(['academy-os-event',snapshot.connectionId,workspaceId,sessionId]));
  calendarEventBody(eventId,snapshot.lesson);
  const createMeet=(raw as {createMeet:boolean}).createMeet;
  if(createMeet&&snapshot.lesson.mode==='ONSITE')throw new CalendarSyncConflict('An in-person class cannot request a virtual meeting');
  const context=JSON.stringify(['google-calendar-token',workspaceId,userId]);
  let credentials=JSON.parse(this.crypto.open(snapshot.encryptedCredentials,context)) as GoogleCredential;
  if(credentials.expiresAt<=Date.now()+60_000){
   credentials=await this.provider.refresh(credentials);
   const encrypted=this.crypto.seal(JSON.stringify(credentials),context);
   if(!await this.repo.replaceCredential(workspaceId,userId,snapshot.connectionId,snapshot.encryptedCredentials,encrypted))
    throw new CalendarSyncConflict('The connection changed; try again');
  }
  return this.provider.sync(credentials.accessToken,eventId,snapshot.lesson,createMeet);
 }
}
