import type {CalendarLesson} from '../domain/calendar.js';
export type CalendarScope='ALL'|'TEACHER'|'STUDENT';
export interface CalendarReadRepository {
 memberships(workspaceId:string,userId:string):Promise<string[]>;
 lessons(workspaceId:string,userId:string,scope:CalendarScope):Promise<CalendarLesson[]>;
}
