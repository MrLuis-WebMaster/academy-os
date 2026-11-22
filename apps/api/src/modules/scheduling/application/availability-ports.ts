import type {WeeklySlotValue} from '../domain/weekly-availability.js';
export interface WeeklySlotRecord extends WeeklySlotValue {
  id:string;teacherProfileId:string;workspaceId:string;
}
export interface AvailabilityRepository {
  teacherInWorkspace(workspaceId:string,teacherId:string):Promise<boolean>;
  list(workspaceId:string):Promise<WeeklySlotRecord[]>;
  add(workspaceId:string,teacherId:string,slot:WeeklySlotValue):Promise<WeeklySlotRecord>;
  remove(workspaceId:string,id:string):Promise<boolean>;
}
