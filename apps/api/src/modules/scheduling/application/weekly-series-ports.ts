import type {LessonWindow} from '../domain/weekly-series.js';

export type SeriesMode='ONLINE'|'ONSITE'|'HYBRID';
export interface WeeklySeriesTemplate extends LessonWindow {
 title:string;teacherProfileId:string;courseId?:string;
 mode:SeriesMode;capacity:number;location?:string;meetingUrl?:string;repeatWeeks:number;
}
export interface WeeklySeriesResult {
 seriesId:string;count:number;timeZone:string;
 lessons:Array<{id:string;title:string;startsAt:Date;endsAt:Date;seriesIndex:number}>;
}
export interface WeeklySeriesRepository {
 workspaceTimezone(workspaceId:string):Promise<string|null>;
 isAssignedTeacher(workspaceId:string,userId:string,teacherProfileId:string):Promise<boolean>;
 create(workspaceId:string,actorId:string,draft:WeeklySeriesTemplate,
  windows:readonly LessonWindow[],timeZone:string):Promise<WeeklySeriesResult>;
}
