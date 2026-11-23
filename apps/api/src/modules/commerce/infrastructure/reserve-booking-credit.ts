import type {Prisma} from '../../../generated/prisma/client.js';

/** Debit an existing staff-issued entitlement in the same transaction as the new booking.
 * The caller must hold academy-os:booking:<sessionId>, and the matching course-policy lock.
 * The grant lock is always acquired after both booking and course locks.
 */
export class PackageCreditRequired extends Error {
 constructor(message='This course requires an available class-package credit'){
  super(message);this.name='PackageCreditRequired';
 }
}
export async function reserveBookingCredit(
 tx:Prisma.TransactionClient,
 input:{workspaceId:string;userId:string;bookingId:string;courseId:string;startsAt:Date},
):Promise<{entitlementId:string;alreadyRedeemed:boolean}>{
 const {workspaceId,userId,bookingId,courseId,startsAt}=input;
 const current=await tx.classPackageRedemption.findUnique({
  where:{bookingId},select:{id:true,entitlementId:true,refundedAt:true},
 });
 if(current&&!current.refundedAt){
  const grant=await tx.classPackageEntitlement.findFirst({
   where:{id:current.entitlementId,workspaceId,studentUserId:userId,package:{workspaceId}},
   select:{id:true},
  });
  if(!grant)throw new PackageCreditRequired('This booking has an invalid entitlement');
  return {entitlementId:grant.id,alreadyRedeemed:true};
 }
 const candidates=await tx.classPackageEntitlement.findMany({
  where:{
   workspaceId,studentUserId:userId,revokedAt:null,expiresAt:{gte:startsAt},
   package:{workspaceId},
  },
  select:{id:true,package:{select:{courseId:true,courseRestricted:true}}},
  orderBy:[{expiresAt:'asc'},{id:'asc'}],
  take:300,
 });
 for(const candidate of candidates){
  if(candidate.package.courseRestricted&&candidate.package.courseId!==courseId)continue;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:package-grant:'+candidate.id}))::text AS lock_acquired`;
  const grant=await tx.classPackageEntitlement.findFirst({
   where:{
    id:candidate.id,workspaceId,studentUserId:userId,revokedAt:null,
    expiresAt:{gte:startsAt},
    package:{workspaceId},
   },
   select:{
    id:true,credits:true,
    package:{select:{courseId:true,courseRestricted:true}},
   },
  });
  if(!grant||grant.package.courseRestricted&&grant.package.courseId!==courseId)continue;
  if(grant.credits<1||startsAt.getTime()<=Date.now())continue;
  const used=await tx.classPackageRedemption.count({
   where:{entitlementId:grant.id,refundedAt:null},
  });
  if(used>=grant.credits)continue;
  if(current){
   await tx.classPackageRedemption.update({
    where:{id:current.id},
    data:{entitlementId:grant.id,refundedAt:null,redeemedAt:new Date()},
   });
  }else{
   await tx.classPackageRedemption.create({
    data:{entitlementId:grant.id,bookingId},
   });
  }
  return {entitlementId:grant.id,alreadyRedeemed:false};
 }
 throw new PackageCreditRequired();
}
