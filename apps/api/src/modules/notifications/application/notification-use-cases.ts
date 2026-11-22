import type {MembershipPort} from '../../academics/application/ports.js';
import type {NotificationMailboxRepository} from './ports.js';
import {notificationId} from '../domain/notification.js';

export class NotificationAccessDenied extends Error {
  constructor(){super('You are not a member of this academy');this.name='NotificationAccessDenied';}
}
export class NotificationNotFound extends Error {
  constructor(){super('Notification not found');this.name='NotificationNotFound';}
}
export class NotificationUseCases {
  constructor(private readonly mailbox:NotificationMailboxRepository,private readonly memberships:MembershipPort){}
  private async authorize(workspaceId:string,userId:string) {
    if(!workspaceId||!userId||!await this.memberships.hasAnyRole(workspaceId,userId,['OWNER','ADMIN','TEACHER','STUDENT','GUARDIAN'])) {
      throw new NotificationAccessDenied();
    }
  }
  async list(workspaceId:string,userId:string) {
    await this.authorize(workspaceId,userId);
    return this.mailbox.list(workspaceId,userId);
  }
  async read(workspaceId:string,userId:string,input:unknown) {
    await this.authorize(workspaceId,userId);
    const id=notificationId(input);
    if(!await this.mailbox.read(workspaceId,userId,id))throw new NotificationNotFound();
    return {id,read:true};
  }
  async readAll(workspaceId:string,userId:string) {
    await this.authorize(workspaceId,userId);
    const count=await this.mailbox.readAll(workspaceId,userId);
    return {readCount:count};
  }
}
