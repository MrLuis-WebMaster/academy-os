import type {CalendarReadRepository,CalendarScope} from './ports.js';
import {serializeAcademyCalendar} from '../domain/calendar.js';

export class CalendarAccessDenied extends Error {
 constructor(){super('This calendar is not available for your academy membership');this.name='CalendarAccessDenied';}
}
export class ExportCalendarUseCase {
 constructor(private readonly reader:CalendarReadRepository){}
 async execute(workspaceId:string,userId:string):Promise<string>{
  if(!workspaceId||!userId)throw new CalendarAccessDenied();
  const roles=await this.reader.memberships(workspaceId,userId);
  let scope:CalendarScope;
  if(roles.some(r=>r==='OWNER'||r==='ADMIN'))scope='ALL';
  else if(roles.includes('TEACHER'))scope='TEACHER';
  else if(roles.includes('STUDENT'))scope='STUDENT';
  else throw new CalendarAccessDenied();
  const lessons=await this.reader.lessons(workspaceId,userId,scope);
  return serializeAcademyCalendar(lessons);
 }
}
