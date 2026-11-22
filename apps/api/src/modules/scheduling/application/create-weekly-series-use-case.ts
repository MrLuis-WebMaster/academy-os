import type {MembershipPort} from '../../academics/application/ports.js';
import {planWeeklySeries} from '../domain/weekly-series.js';
import type {WeeklySeriesRepository,WeeklySeriesTemplate} from './weekly-series-ports.js';

export class WeeklySeriesNotAllowed extends Error {
 constructor(){super('Only academy managers or the assigned teacher can create weekly lessons');this.name='WeeklySeriesNotAllowed';}
}
export class WeeklySeriesReferenceInvalid extends Error {
 constructor(message='Teacher or course does not belong to the academy'){
  super(message);this.name='WeeklySeriesReferenceInvalid';
 }
}
export class WeeklySeriesConflict extends Error {
 constructor(message='One or more weekly lessons conflict with existing sessions or teacher availability'){
  super(message);this.name='WeeklySeriesConflict';
 }
}
export class CreateWeeklySeriesUseCase {
 constructor(private readonly series:WeeklySeriesRepository,private readonly members:MembershipPort){}
 async execute(workspaceId:string,userId:string,draft:WeeklySeriesTemplate){
  if(!workspaceId||!userId||!draft.teacherProfileId)throw new WeeklySeriesNotAllowed();
  const isAdmin=await this.members.hasAnyRole(workspaceId,userId,['OWNER','ADMIN']);
  if(!isAdmin){
   const teacher=await this.members.hasAnyRole(workspaceId,userId,['TEACHER'])
    && await this.series.isAssignedTeacher(workspaceId,userId,draft.teacherProfileId);
   if(!teacher)throw new WeeklySeriesNotAllowed();
  }
  const timeZone=await this.series.workspaceTimezone(workspaceId);
  if(!timeZone)throw new WeeklySeriesReferenceInvalid('Academy does not exist');
  const windows=planWeeklySeries(draft,draft.repeatWeeks,timeZone);
  return this.series.create(workspaceId,userId,draft,windows,timeZone);
 }
}
