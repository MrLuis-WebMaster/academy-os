import type {TimeOffWindow} from '../domain/time-off.js';

export interface TimeOffRecord extends TimeOffWindow {
 id:string;
 workspaceId:string;
 teacherProfileId:string;
 createdAt:Date;
}
export interface TeacherTimeOffRepository {
 teacherForUser(workspaceId:string,userId:string):Promise<string|null>;
 belongsToWorkspace(workspaceId:string,teacherProfileId:string):Promise<boolean>;
 list(workspaceId:string,teacherProfileId?:string):Promise<TimeOffRecord[]>;
 create(workspaceId:string,teacherProfileId:string,actorId:string,window:TimeOffWindow):Promise<TimeOffRecord>;
 remove(workspaceId:string,id:string,teacherProfileId?:string):Promise<boolean>;
}
