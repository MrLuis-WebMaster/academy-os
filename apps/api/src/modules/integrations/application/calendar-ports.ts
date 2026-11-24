import type {CalendarClass,CalendarSyncResult} from '../domain/calendar-event.js';
import type {GoogleCredential} from '../domain/google-connection.js';
export type CalendarExportSnapshot={connectionId:string;encryptedCredentials:string;lesson:CalendarClass};
export interface CalendarExportRepository{
 snapshot(workspaceId:string,userId:string,sessionId:string):Promise<CalendarExportSnapshot|null>;
 replaceCredential(workspaceId:string,userId:string,connectionId:string,oldValue:string,newValue:string):Promise<boolean>;
}
export interface CalendarEventPort{
 configured():boolean;
 refresh(credential:GoogleCredential):Promise<GoogleCredential>;
 sync(accessToken:string,eventId:string,lesson:CalendarClass,createMeet:boolean):Promise<CalendarSyncResult>;
}
