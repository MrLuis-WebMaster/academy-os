export interface WeeklySeriesCancellationReceipt {
 seriesId:string;
 cancelledSessions:number;
 inAppNotificationsCreated:number;
 historicalSessionsPreserved:boolean;
}
export interface WeeklySeriesCancellationRepository {
 belongsToAssignedTeacher(workspaceId:string,userId:string,seriesId:string):Promise<boolean>;
 cancelFuture(workspaceId:string,seriesId:string):Promise<WeeklySeriesCancellationReceipt>;
}
