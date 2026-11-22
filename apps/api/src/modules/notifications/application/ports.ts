export interface NotificationItem {
 id:string;kind:string;title:string;body:string;sessionId:string|null;
 createdAt:Date;readAt:Date|null;
}
export interface NotificationMailboxRepository {
 list(workspaceId:string,userId:string):Promise<{items:NotificationItem[];unreadCount:number}>;
 read(workspaceId:string,userId:string,notificationId:string):Promise<boolean>;
 readAll(workspaceId:string,userId:string):Promise<number>;
}
