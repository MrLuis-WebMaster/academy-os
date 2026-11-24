import type {CalendarExportRepository,CalendarEventPort} from './calendar-ports.js';
import type {IntegrationCryptoPort} from './google-ports.js';
import {CalendarSyncConflict,calendarEventBody,safeMeetUrl} from '../domain/calendar-event.js';
import {IntegrationDenied,IntegrationUnavailable,type GoogleCredential} from '../domain/google-connection.js';
export class ExportClassToCalendar{
 constructor(private readonly repo:CalendarExportRepository,private readonly provider:CalendarEventPort,private readonly crypto:IntegrationCryptoPort){}
 async status(workspaceId:string,userId:string,sessionId:string){
  const snapshot=await this.repo.snapshot(workspaceId,userId,sessionId);
  if(!snapshot)throw new IntegrationDenied('No authorized connection or class found');
  return this.repo.autoSyncStatus(workspaceId,userId,sessionId);
 }
 async stop(workspaceId:string,userId:string,sessionId:string){
  const snapshot=await this.repo.snapshot(workspaceId,userId,sessionId);
  if(!snapshot)throw new IntegrationDenied('No authorized connection or class found');
  if(!await this.repo.setAutoSync(workspaceId,userId,snapshot,false))throw new CalendarSyncConflict('Connection changed');
  return {enabled:false};
 }
 async execute(workspaceId:string,userId:string,sessionId:string,raw:unknown,expectedConnection?:{id:string;generation:Date}){
  if(!raw||typeof raw!=='object'||typeof (raw as Record<string,unknown>).createMeet!=='boolean')
   throw new CalendarSyncConflict('Explicit conference preference required');
  if(!this.provider.configured())throw new IntegrationUnavailable('Google Calendar integration is disabled');
  const snapshot=await this.repo.snapshot(workspaceId,userId,sessionId);
  if(!snapshot)throw new IntegrationDenied('No authorized connection or class found');
  if(expectedConnection&&(snapshot.connectionId!==expectedConnection.id||snapshot.connectedAt.getTime()!==expectedConnection.generation.getTime()))
   throw new IntegrationDenied('Calendar connection changed');
  const eventId=this.crypto.digest(JSON.stringify(['academy-os-event',snapshot.connectionId,workspaceId,sessionId]));
  calendarEventBody(eventId,snapshot.lesson);
  const input=raw as {createMeet:boolean;publishMeet?:unknown;autoSync?:unknown};
  const createMeet=input.createMeet;
  if(input.publishMeet!==undefined&&typeof input.publishMeet!=='boolean')throw new CalendarSyncConflict('Invalid publication preference');
  const publishMeet=input.publishMeet===true;
  if(input.autoSync!==undefined&&typeof input.autoSync!=='boolean')throw new CalendarSyncConflict('Invalid synchronization preference');
  if(expectedConnection&&input.autoSync!==undefined)throw new CalendarSyncConflict('Worker cannot change consent');
  if(publishMeet&&(!createMeet||snapshot.lesson.status!=='CONFIRMED'||snapshot.lesson.mode==='ONSITE'||snapshot.lesson.endsAt<=new Date()))
   throw new CalendarSyncConflict('Meet publication requires an active virtual class and explicit conference request');
  if(createMeet&&snapshot.lesson.mode==='ONSITE')throw new CalendarSyncConflict('An in-person class cannot request a virtual meeting');
  const context=JSON.stringify(['google-calendar-token',workspaceId,userId]);
  let credentials=JSON.parse(this.crypto.open(snapshot.encryptedCredentials,context)) as GoogleCredential;
  if(credentials.expiresAt<=Date.now()+60_000){
   credentials=await this.provider.refresh(credentials);
   const encrypted=this.crypto.seal(JSON.stringify(credentials),context);
   if(!await this.repo.replaceCredential(workspaceId,userId,snapshot.connectionId,snapshot.encryptedCredentials,encrypted))
    throw new CalendarSyncConflict('The connection changed; try again');
  }
  const result=await this.provider.sync(credentials.accessToken,eventId,snapshot.lesson,createMeet,!!expectedConnection);
  if(typeof input.autoSync==='boolean'){
   if(!await this.repo.setAutoSync(workspaceId,userId,snapshot,input.autoSync&&result.state==='saved'))
    throw new CalendarSyncConflict('Calendar event saved, but the connection changed; review synchronization settings');
  }
  const url=safeMeetUrl(result.meetUrl);
  if(publishMeet&&result.state==='saved'&&url){
   if(!await this.repo.publishMeet(workspaceId,userId,snapshot,url))
    throw new CalendarSyncConflict('Calendar event saved, but the class or connection changed; refresh before publishing Meet');
   return {...result,meetUrl:url,meetPublished:true};
  }
  return {...result,meetUrl:url,meetPublished:false};
 }
}
