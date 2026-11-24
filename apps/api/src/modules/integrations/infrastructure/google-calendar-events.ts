import {randomUUID} from 'node:crypto';
import type {CalendarEventPort} from '../application/calendar-ports.js';
import {CALENDAR_SCOPE,type GoogleCredential} from '../domain/google-connection.js';
import {CalendarProviderError,CalendarSyncConflict,calendarEventBody,safeMeetUrl,type CalendarClass,type CalendarSyncResult} from '../domain/calendar-event.js';
import type {GoogleOAuthConfig} from './google-oauth.js';

type EventResponse={extendedProperties?:{private?:{academyOS?:string}};status?:string;hangoutLink?:string;conferenceData?:{createRequest?:{status?:{statusCode?:string}};conferenceId?:string}};
const base='https://www.googleapis.com/calendar/v3/calendars/primary/events';
export class GoogleCalendarEvents implements CalendarEventPort{
 constructor(private readonly config:GoogleOAuthConfig,private readonly transport:typeof fetch=fetch){}
 configured(){return this.config.enabled&&!!this.config.clientId&&!!this.config.clientSecret;}
 async refresh(previous:GoogleCredential):Promise<GoogleCredential>{
  const response=await this.transport('https://oauth2.googleapis.com/token',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(10_000),
   headers:{'content-type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({client_id:this.config.clientId,client_secret:this.config.clientSecret,
    refresh_token:previous.refreshToken,grant_type:'refresh_token'}),
  });
  if(!response.ok)throw new CalendarProviderError('Google connection needs authorization again');
  const raw=await response.json() as Record<string,unknown>;
  const scope=typeof raw.scope==='string'?raw.scope:previous.scope;
  if(typeof raw.access_token!=='string'||!raw.access_token||typeof raw.expires_in!=='number'||
    !Number.isFinite(raw.expires_in)||raw.expires_in<=0||!scope.split(/\s+/).includes(CALENDAR_SCOPE))
   throw new CalendarProviderError('Google returned invalid or insufficient permissions');
  return {accessToken:raw.access_token,refreshToken:typeof raw.refresh_token==='string'&&raw.refresh_token?raw.refresh_token:previous.refreshToken,
    expiresAt:Date.now()+raw.expires_in*1000,scope};
 }
 private async call(token:string,path:string,method:string,body?:unknown){
  return this.transport(base+path,{method,redirect:'error',signal:AbortSignal.timeout(10_000),
   headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 }
 private async existing(token:string,eventId:string):Promise<EventResponse|null>{
  const response=await this.call(token,'/'+eventId,'GET');
  if(response.status===404||response.status===410)return null;
  if(!response.ok)throw new CalendarProviderError('Google Calendar could not be reached');
  const event=await response.json() as EventResponse;
  if(event.extendedProperties?.private?.academyOS!==eventId)
   throw new CalendarSyncConflict('The existing calendar event does not belong to AcademyOS');
  return event;
 }
 async sync(token:string,eventId:string,lesson:CalendarClass,createMeet:boolean,existingOnly=false):Promise<CalendarSyncResult>{
  if(!/^[a-f0-9]{64}$/.test(eventId))throw new CalendarSyncConflict('Invalid event identity');
  const body=calendarEventBody(eventId,lesson);
  const current=await this.existing(token,eventId);
  const query='?sendUpdates=none&conferenceDataVersion=1';
  if(lesson.status==='CANCELLED'){
   if(current&&current.status!=='cancelled'){
    const response=await this.call(token,'/'+eventId+'?sendUpdates=none','DELETE');
    if(!response.ok&&![404,410].includes(response.status))throw new CalendarProviderError('Calendar removal failed');
   }
   return {state:'removed',meetUrl:null,conferencePending:false};
  }
  if(existingOnly&&!current)throw new CalendarSyncConflict('Event missing; use manual export to reconcile');
  if(current?.status==='cancelled')throw new CalendarSyncConflict('The event was deleted in Google Calendar');
  const pending=current?.conferenceData?.createRequest?.status?.statusCode==='pending';
  const hasConference=!!(current?.conferenceData?.conferenceId||safeMeetUrl(current?.hangoutLink));
  const conference=createMeet&&!hasConference&&!pending?{conferenceData:{createRequest:{
   requestId:randomUUID(),conferenceSolutionKey:{type:'hangoutsMeet'},
  }}}:{};
  const response=current
   ?await this.call(token,'/'+eventId+query,'PATCH',{...body,...conference})
   :await this.call(token,query,'POST',{id:eventId,...body,...conference});
  if(response.status===409)throw new CalendarSyncConflict('Calendar event already exists; retry the export');
  if(!response.ok)throw new CalendarProviderError('Google Calendar rejected the event change');
  const event=await response.json() as EventResponse;
  return {state:'saved',meetUrl:safeMeetUrl(event.hangoutLink),conferencePending:event.conferenceData?.createRequest?.status?.statusCode==='pending'};
 }
}
