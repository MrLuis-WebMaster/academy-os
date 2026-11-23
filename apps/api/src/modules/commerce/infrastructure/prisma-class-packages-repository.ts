import {prisma} from '../../../lib/prisma.js';
import {grantExpiry,remainingCredits} from '../domain/class-package.js';
import type {PackageIssueInput,PackagePlanInput,PackageRedemptionInput} from '../domain/class-package.js';
import type {ClassPackagesRepository,PackagePlanView,PackageEntitlementView} from '../application/package-ports.js';
import {PackageAccessDenied,PackageConflict,PackageNotFound} from '../application/package-use-cases.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import {notifyUser} from '../../notifications/infrastructure/personal-notice-publisher.js';

const planSelect={
 id:true,title:true,courseId:true,sessionCredits:true,priceCOP:true,
 validDays:true,active:true,createdAt:true,
} as const;
const grantSelect={
 id:true,packageId:true,studentUserId:true,credits:true,expiresAt:true,
 issuedAt:true,revokedAt:true,
 package:{select:{title:true,courseId:true,priceCOP:true}},
 redemptions:{select:{id:true},where:{refundedAt:null}},
} as const;

function grantView(row:{
 id:string;packageId:string;studentUserId:string;credits:number;
 expiresAt:Date;issuedAt:Date;revokedAt:Date|null;
 package:{title:string;courseId:string|null;priceCOP:number};
 redemptions:readonly {id:string}[];
}):PackageEntitlementView{
 const used=row.redemptions.length;
 return {
  id:row.id,packageId:row.packageId,studentUserId:row.studentUserId,
  credits:row.credits,used,remaining:remainingCredits(row.credits,used),
  expiresAt:row.expiresAt,issuedAt:row.issuedAt,revokedAt:row.revokedAt,
  package:row.package,
 };
}
export class PrismaClassPackagesRepository implements ClassPackagesRepository{
 private async manager(tx:Prisma.TransactionClient,workspaceId:string,userId:string){
  const row=await tx.workspaceMember.findFirst({
   where:{workspaceId,userId,role:{in:['OWNER','ADMIN']}},select:{id:true},
  });
  if(!row)throw new PackageAccessDenied();
 }
 private async student(tx:Prisma.TransactionClient,workspaceId:string,userId:string){
  const row=await tx.workspaceMember.findFirst({
   where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
  });
  if(!row)throw new PackageAccessDenied();
 }
 async plans(workspaceId:string,actorId:string):Promise<PackagePlanView[]>{
  return prisma.$transaction(async tx=>{
   await this.manager(tx,workspaceId,actorId);
   return tx.classPackage.findMany({
    where:{workspaceId},select:planSelect,orderBy:{createdAt:'desc'},take:150,
   });
  });
 }
 async create(workspaceId:string,actorId:string,input:PackagePlanInput):Promise<PackagePlanView>{
  return prisma.$transaction(async tx=>{
   await this.manager(tx,workspaceId,actorId);
   if(input.courseId&&!await tx.course.findFirst({
    where:{id:input.courseId,workspaceId},select:{id:true},
   }))throw new PackageNotFound();
   return tx.classPackage.create({
    data:{
     workspaceId,courseId:input.courseId??null,title:input.title,
     sessionCredits:input.sessionCredits,priceCOP:input.priceCOP,validDays:input.validDays,
    },select:planSelect,
   });
  });
 }
 async setActive(workspaceId:string,actorId:string,packageId:string,active:boolean){
  return prisma.$transaction(async tx=>{
   await this.manager(tx,workspaceId,actorId);
   const row=await tx.classPackage.updateMany({where:{workspaceId,id:packageId},data:{active}});
   if(!row.count)throw new PackageNotFound();
   return tx.classPackage.findUniqueOrThrow({where:{id:packageId},select:planSelect});
  });
 }
 async issue(workspaceId:string,actorId:string,packageId:string,input:PackageIssueInput){
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:issue-package:'+input.requestId}))::text AS lock_acquired`;
   await this.manager(tx,workspaceId,actorId);
   // Repeat requests with a stable UUID MUST NOT issue credits a second time.
   const prior=await tx.classPackageEntitlement.findUnique({
    where:{requestId:input.requestId},select:{...grantSelect,workspaceId:true},
   });
   if(prior){
    if(prior.workspaceId!==workspaceId||prior.packageId!==packageId||prior.studentUserId!==input.studentUserId){
     throw new PackageConflict('Idempotency key has been used for a different issuance');
    }
    return grantView(prior);
   }
   const [plan,member]=await Promise.all([
    tx.classPackage.findFirst({where:{workspaceId,id:packageId},select:{
     id:true,title:true,courseId:true,active:true,validDays:true,sessionCredits:true,
    }}),
    tx.workspaceMember.findFirst({
     where:{workspaceId,userId:input.studentUserId,role:'STUDENT'},select:{id:true},
    }),
   ]);
   if(!plan)throw new PackageNotFound();
   if(!plan.active)throw new PackageConflict('Package is not available for new issuance');
   if(!member)throw new PackageAccessDenied();
   if(plan.courseId&&!await tx.enrollment.findFirst({
    where:{courseId:plan.courseId,userId:input.studentUserId,course:{workspaceId}},
    select:{id:true},
   }))throw new PackageAccessDenied();
   const now=new Date();
   const created=await tx.classPackageEntitlement.create({
    data:{
     workspaceId,packageId,studentUserId:input.studentUserId,
     issuedByUserId:actorId,requestId:input.requestId,
     note:input.note??null,credits:plan.sessionCredits,
     expiresAt:grantExpiry(now,plan.validDays),
    },select:grantSelect,
   });
   await notifyUser(tx,{
    workspaceId,userId:input.studentUserId,kind:'PACKAGE_ISSUED',
    eventKey:'package-issued:'+created.id,title:'Tienes un paquete de clases disponible',
    body:'Tu academia te asignó el paquete "'+plan.title.slice(0,100)+'". Consulta sus créditos y vigencia antes de reservar.',
   });
   return grantView(created);
  });
 }
 async mine(workspaceId:string,userId:string){
  return prisma.$transaction(async tx=>{
   await this.student(tx,workspaceId,userId);
   const rows=await tx.classPackageEntitlement.findMany({
    where:{workspaceId,studentUserId:userId,package:{workspaceId}},
    select:grantSelect,orderBy:{issuedAt:'desc'},take:100,
   });
   return rows.map(grantView);
  });
 }
 async redeem(workspaceId:string,userId:string,input:PackageRedemptionInput){
  return prisma.$transaction(async tx=>{
   // Match the booking lock used by the scheduling module before taking a grant lock.
   const candidate=await tx.classBooking.findFirst({
    where:{id:input.bookingId,workspaceId,userId,session:{workspaceId}},
    select:{sessionId:true},
   });
   if(!candidate)throw new PackageNotFound();
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+candidate.sessionId}))::text AS lock_acquired`;
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:package-grant:'+input.entitlementId}))::text AS lock_acquired`;
   await this.student(tx,workspaceId,userId);
   const [booking,grant,already]=await Promise.all([
    tx.classBooking.findFirst({
     where:{id:input.bookingId,workspaceId,userId,session:{workspaceId}},
     select:{
      id:true,status:true,session:{select:{courseId:true,status:true,startsAt:true}},
     },
    }),
    tx.classPackageEntitlement.findFirst({
     where:{
      id:input.entitlementId,workspaceId,studentUserId:userId,package:{workspaceId},
     },
     select:{id:true,credits:true,expiresAt:true,revokedAt:true,
      package:{select:{courseId:true}},
     },
    }),
    tx.classPackageRedemption.findUnique({
     where:{bookingId:input.bookingId},select:{
      id:true,entitlementId:true,refundedAt:true,
     },
    }),
   ]);
   if(!booking||!grant)throw new PackageNotFound();
   if(booking.status!=='BOOKED'||booking.session.status!=='CONFIRMED'
     ||booking.session.startsAt.getTime()<=Date.now())
    throw new PackageConflict('Only future confirmed class bookings can redeem credits');
   if(grant.package.courseId!==null&&grant.package.courseId!==booking.session.courseId)
    throw new PackageAccessDenied();
   if(grant.expiresAt.getTime()<=Date.now()||booking.session.startsAt>grant.expiresAt
     ||grant.revokedAt!==null)throw new PackageConflict('Package is expired or unavailable');
   if(already){
    if(already.entitlementId!==grant.id)throw new PackageConflict('This booking already uses another package');
    if(!already.refundedAt){
     const used=await tx.classPackageRedemption.count({
      where:{entitlementId:grant.id,refundedAt:null},
     });
     return {id:already.id,bookingId:booking.id,entitlementId:grant.id,
      remaining:remainingCredits(grant.credits,used),alreadyRedeemed:true};
    }
   }
   const used=await tx.classPackageRedemption.count({
    where:{entitlementId:grant.id,refundedAt:null},
   });
   if(used>=grant.credits)throw new PackageConflict('No package credits remain');
   const record=already
    ?await tx.classPackageRedemption.update({
      where:{id:already.id},data:{refundedAt:null,redeemedAt:new Date()},
      select:{id:true},
     })
    :await tx.classPackageRedemption.create({
      data:{entitlementId:grant.id,bookingId:booking.id},select:{id:true},
     });
   return {
    id:record.id,bookingId:booking.id,entitlementId:grant.id,
    remaining:remainingCredits(grant.credits,used+1),alreadyRedeemed:false,
   };
  });
 }
}
