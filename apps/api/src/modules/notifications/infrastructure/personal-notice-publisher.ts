import type {Prisma} from '../../../generated/prisma/client.js';
import type {NotificationKind} from '../domain/notification.js';

export interface PersonalNotice {
 workspaceId:string;userId:string;eventKey:string;kind:NotificationKind;
 title:string;body:string;sessionId?:string|null;
}
/** Generic in-app event delivery, idempotent per recipient/academy/event. */
export async function notifyUser(tx:Prisma.TransactionClient,event:PersonalNotice):Promise<number>{
 const created=await tx.notification.createMany({
  data:[{
   workspaceId:event.workspaceId,userId:event.userId,eventKey:event.eventKey,
   kind:event.kind,title:event.title.slice(0,140),body:event.body.slice(0,500),
   sessionId:event.sessionId??null,
  }],
  skipDuplicates:true,
 });
 return created.count;
}
