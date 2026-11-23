import type {ReminderPreferences} from '../domain/reminder-policy.js';
export interface ReminderPreferenceRepository {
  read(workspaceId:string,actorId:string):Promise<ReminderPreferences>;
  save(workspaceId:string,actorId:string,value:ReminderPreferences):Promise<ReminderPreferences>;
}
export interface ReminderDispatchReceipt {
  visitedSessions:number;createdNotifications:number;
}
export interface ReminderDeliveryRepository {
  deliverDue(now:Date):Promise<ReminderDispatchReceipt>;
}
