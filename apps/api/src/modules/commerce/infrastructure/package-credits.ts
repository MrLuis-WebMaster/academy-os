import type {Prisma} from '../../../generated/prisma/client.js';

/** Return class credits inside the SAME transaction as a booking/session cancellation.
 * Callers must already hold the academy-os:booking:<sessionId> advisory lock.
 */
export async function refundBookingCredit(tx:Prisma.TransactionClient,bookingId:string){
 const change=await tx.classPackageRedemption.updateMany({
  where:{bookingId,refundedAt:null},
  data:{refundedAt:new Date()},
 });
 return change.count;
}
export async function refundSessionCredits(tx:Prisma.TransactionClient,sessionId:string){
 const change=await tx.classPackageRedemption.updateMany({
  where:{refundedAt:null,booking:{sessionId}},
  data:{refundedAt:new Date()},
 });
 return change.count;
}
export async function refundStudentSeriesCredits(
 tx:Prisma.TransactionClient,workspaceId:string,userId:string,sessionIds:string[],
){
 if(!sessionIds.length)return 0;
 const change=await tx.classPackageRedemption.updateMany({
  where:{refundedAt:null,booking:{workspaceId,userId,sessionId:{in:sessionIds},status:'CANCELLED'}},
  data:{refundedAt:new Date()},
 });
 return change.count;
}
