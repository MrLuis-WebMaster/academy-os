import type {CalendarClass,CalendarSyncResult} from '../domain/calendar-event.js';
import type {GoogleCredential} from '../domain/google-connection.js';
export type CalendarExportSnapshot={connectionId:string;connectedAt:Date;encryptedCredentials:string;lesson:CalendarClass & {meetingUrl:string|null;provider:string|null}};
export interface CalendarExportRepository{
 snapshot(workspaceId:string,userId:string,sessionId:string):Promise<CalendarExportSnapshot|null>;
 publishMeet(workspaceId:string,userId:string,snapshot:CalendarExportSnapshot,meetUrl:string):Promise<boolean>;
 replaceCredential(workspaceId:string,userId:string,connectionId:string,oldValue:string,newValue:string):Promise<boolean>;
}
export interface CalendarEventPort{
 configured():boolean;
 refresh(credential:GoogleCredential):Promise<GoogleCredential>;
 sync(accessToken:string,eventId:string,lesson:CalendarClass,createMeet:boolean):Promise<CalendarSyncResult>;
}
