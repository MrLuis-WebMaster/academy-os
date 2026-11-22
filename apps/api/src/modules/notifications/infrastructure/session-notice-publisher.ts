import type {Prisma} from '../../../generated/prisma/client.js';
import {sessionNotice} from '../domain/notification.js';
import type {NotificationKind} from '../domain/notification.js';

export interface PublishClassNotice {
 workspaceId:string;sessionId:string;sessionTitle:string;kind:NotificationKind;eventKey:string;
}

/** Called only inside the scheduling transaction: no notices on a rolled-back class change. */
export async function notifyBookedStudents(tx:Prisma.TransactionClient, event:PublishClassNotice) {
 const bookings=await tx.classBooking.findMany({
  where:{workspaceId:event.workspaceId,sessionId:event.sessionId,status:'BOOKED'},
  select:{userId:true},
 });
 const recipients=[...new Set(bookings.map(b=>b.userId))];
 if(!recipients.length)return 0;
 const {title,body}=sessionNotice(event.kind,event.sessionTitle);
 const created=await tx.notification.createMany({
  data:recipients.map(userId=>({
   workspaceId:event.workspaceId,userId,sessionId:event.sessionId,
   eventKey:event.eventKey,kind:event.kind,title,body,
  })),skipDuplicates:true,
 });
 return created.count;
}
