import type {ReschedulePlan} from '../domain/reschedule.js';
export interface SessionRescheduleReceipt {
  id:string;
  startsAt:Date;
  endsAt:Date;
  affectedBookings:number;
  manualNotificationRequired:boolean;
  reason:string;
}
export interface SessionRescheduleRepository {
  belongsToTeacher(workspaceId:string,userId:string,sessionId:string):Promise<boolean>;
  reschedule(workspaceId:string,sessionId:string,actorUserId:string,plan:ReschedulePlan):Promise<SessionRescheduleReceipt>;
}
