import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {ClassPackagesUseCases} from '../modules/commerce/application/package-use-cases.js';
import {PrismaClassPackagesRepository} from '../modules/commerce/infrastructure/prisma-class-packages-repository.js';
import {ClassPackagesController} from '../modules/commerce/presentation/packages.controller.js';
import {BookingUseCases} from '../modules/scheduling/application/booking-use-cases.js';
import {PrismaBookingRepository} from '../modules/scheduling/infrastructure/prisma-booking-repository.js';
import {BookingActionsController} from '../modules/scheduling/presentation/booking-actions.controller.js';
import {LessonsController} from '../modules/scheduling/presentation/lessons.controller.js';
import {LessonUseCases} from '../modules/scheduling/application/lesson-use-cases.js';
import {PrismaLessonRepository} from '../modules/scheduling/infrastructure/prisma-lesson-repository.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string;name:string}):AuthenticatedRequest{
 return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
test('manual package grants are scoped, idempotent and credits are serialized/refunded across bookings',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,14);
 const users=await Promise.all([
  prisma.user.create({data:{name:'Manager',email:'pack-manager-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Student',email:'pack-student-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Other Student',email:'pack-other-student-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Foreign Owner',email:'pack-foreign-'+nonce+'@example.invalid'}}),
 ]);
 const [manager,student,otherStudent,foreign]=users;
 const wsIds:string[]=[];
 try{
  const a=await prisma.workspace.create({data:{
   slug:'pack-a-'+nonce,name:'Language Academy',type:'ACADEMY',
   members:{create:[
    {userId:manager!.id,role:'OWNER'},
    {userId:student!.id,role:'STUDENT'},
    {userId:otherStudent!.id,role:'STUDENT'},
   ]},
  }});
  wsIds.push(a.id);
  const b=await prisma.workspace.create({data:{
   slug:'pack-b-'+nonce,name:'Music Academy',type:'ACADEMY',
   members:{create:{userId:foreign!.id,role:'OWNER'}},
  }});
  wsIds.push(b.id);
  const course=await prisma.course.create({data:{workspaceId:a.id,title:'Speaking B1'}});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
  const tomorrow=new Date(Date.now()+3*86400000);
  const sessions=await Promise.all([0,1,2].map(i=>
   prisma.classSession.create({data:{
    workspaceId:a.id,courseId:course.id,title:'Speaking '+i,mode:'ONLINE',
    status:'CONFIRMED',capacity:8,timezone:'America/Bogota',
    startsAt:new Date(tomorrow.getTime()+i*86400000),
    endsAt:new Date(tomorrow.getTime()+i*86400000+3600000),
    meetingUrl:'https://meet.example.invalid/speaking',
   }}),
  ));
  const packageController=new ClassPackagesController(
   new ClassPackagesUseCases(new PrismaClassPackagesRepository(),new PrismaMembershipAdapter()),
  );
  const bookingController=new BookingActionsController(
   new BookingUseCases(new PrismaBookingRepository(),new PrismaMembershipAdapter()),
  );
  const lessonController=new LessonsController(
   new LessonUseCases(new PrismaLessonRepository(),new PrismaMembershipAdapter()),
  );
  const p=await packageController.create(req(manager!),a.id,{
   title:'Paquete conversacional',courseId:course.id,sessionCredits:1,
   priceCOP:50000,validDays:30,
  });
  await assert.rejects(()=>packageController.create(req(student!),a.id,{
   title:'Falso paquete',sessionCredits:200,priceCOP:0,validDays:365,
  }),ForbiddenException);
  await assert.rejects(()=>packageController.issue(req(foreign!),b.id,p.id,{
   studentUserId:student!.id,requestId:randomUUID(),
  }),NotFoundException);
  await assert.rejects(()=>packageController.issue(req(manager!),a.id,p.id,{
   studentUserId:otherStudent!.id,requestId:randomUUID(),
  }),ForbiddenException);
  const key=randomUUID();
  const grant=await packageController.issue(req(manager!),a.id,p.id,{
   studentUserId:student!.id,requestId:key,
  });
  const duplicated=await packageController.issue(req(manager!),a.id,p.id,{
   studentUserId:student!.id,requestId:key,
  });
  assert.equal(duplicated.id,grant.id);
  assert.equal(await prisma.classPackageEntitlement.count({where:{workspaceId:a.id}}),1);
  assert.equal(grant.credits,1);
  assert.equal(grant.remaining,1);
  assert.equal(await prisma.notification.count({where:{
   workspaceId:a.id,userId:student!.id,kind:'PACKAGE_ISSUED',
  }}),1);
  assert.equal((await packageController.mine(req(student!),a.id))[0]?.remaining,1);
  await assert.rejects(()=>packageController.mine(req(manager!),a.id),ForbiddenException);
  await assert.rejects(()=>packageController.mine(req(foreign!),b.id),ForbiddenException);
  const [first,second]=await Promise.all([
   bookingController.reserve(req(student!),a.id,{sessionId:sessions[0]!.id}),
   bookingController.reserve(req(student!),a.id,{sessionId:sessions[1]!.id}),
  ]);
  const attempt=await Promise.allSettled([
   packageController.redeem(req(student!),a.id,{entitlementId:grant.id,bookingId:first.id}),
   packageController.redeem(req(student!),a.id,{entitlementId:grant.id,bookingId:second.id}),
  ]);
  assert.equal(attempt.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(await prisma.classPackageRedemption.count({where:{entitlementId:grant.id,refundedAt:null}}),1);
  const activeId=attempt[0]?.status==='fulfilled'?first.id:second.id;
  const inactiveId=activeId===first.id?second.id:first.id;
  const repeated=await packageController.redeem(req(student!),a.id,{
   entitlementId:grant.id,bookingId:activeId,
  });
  assert.equal(repeated.alreadyRedeemed,true);
  assert.equal(repeated.remaining,0);
  await assert.rejects(()=>packageController.redeem(req(otherStudent!),a.id,{
   entitlementId:grant.id,bookingId:activeId,
  }),NotFoundException);
  // Student cancellations release credits transactionally, no double return on retries.
  await bookingController.cancel(req(student!),a.id,activeId);
  await bookingController.cancel(req(student!),a.id,activeId);
  assert.equal((await packageController.mine(req(student!),a.id))[0]?.remaining,1);
  const newRedemption=await packageController.redeem(req(student!),a.id,{
   entitlementId:grant.id,bookingId:inactiveId,
  });
  assert.equal(newRedemption.remaining,0);
  // Cancelling a confirmed class returns the package credit to its student.
  const whichSession=inactiveId===first.id?sessions[0]!:sessions[1]!;
  await lessonController.cancel(req(manager!),a.id,whichSession.id);
  assert.equal((await packageController.mine(req(student!),a.id))[0]?.remaining,1);
  await assert.rejects(()=>packageController.redeem(req(student!),a.id,{
   entitlementId:grant.id,bookingId:inactiveId,
  }),ConflictException);
  const third=await bookingController.reserve(req(student!),a.id,{sessionId:sessions[2]!.id});
  assert.equal((await packageController.redeem(req(student!),a.id,{
   entitlementId:grant.id,bookingId:third.id,
  })).remaining,0);
  // Disabling plans prevents future issuance but never deletes already issued credits.
  await packageController.active(req(manager!),a.id,p.id,{active:false});
  await assert.rejects(()=>packageController.issue(req(manager!),a.id,p.id,{
   studentUserId:student!.id,requestId:randomUUID(),
  }),ConflictException);
  assert.equal((await packageController.mine(req(student!),a.id))[0]?.remaining,0);
  assert.equal(await prisma.classPackageEntitlement.count({where:{workspaceId:b.id}}),0);
  assert.equal(await prisma.classPackageRedemption.count({where:{booking:{workspaceId:b.id}}}),0);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:wsIds}}});
  await prisma.user.deleteMany({where:{id:{in:users.map(user=>user.id)}}});
  await prisma.$disconnect();
 }
});

test('deleting a course never broadens an issued course-specific package to other courses',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,12);
 const [owner,student]=await Promise.all([
  prisma.user.create({data:{name:'Owner',email:'pack-scope-owner-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Student',email:'pack-scope-student-'+nonce+'@example.invalid'}}),
 ]);
 let workspaceId='';
 try{
  const workspace=await prisma.workspace.create({data:{
   slug:'pack-scope-'+nonce,name:'Scoped packages',type:'ACADEMY',
   members:{create:[{userId:owner.id,role:'OWNER'},{userId:student.id,role:'STUDENT'}]},
  }});
  workspaceId=workspace.id;
  const course=await prisma.course.create({data:{workspaceId,title:'Curso de piano'}});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student.id}});
  const startsAt=new Date(Date.now()+4*86400000);
  const classSession=await prisma.classSession.create({data:{
   workspaceId,courseId:course.id,title:'Lección de piano',status:'CONFIRMED',
   mode:'ONLINE',timezone:'America/Bogota',capacity:4,
   startsAt,endsAt:new Date(startsAt.getTime()+3600000),
  }});
  const booking=await prisma.classBooking.create({data:{
   workspaceId,sessionId:classSession.id,userId:student.id,status:'BOOKED',
  }});
  const controller=new ClassPackagesController(
   new ClassPackagesUseCases(new PrismaClassPackagesRepository(),new PrismaMembershipAdapter()),
  );
  const plan=await controller.create(req(owner),workspaceId,{
   title:'Piano cuatro clases',courseId:course.id,sessionCredits:4,priceCOP:100000,validDays:60,
  });
  assert.equal(plan.courseRestricted,true);
  const grant=await controller.issue(req(owner),workspaceId,plan.id,{
   studentUserId:student.id,requestId:randomUUID(),
  });
  await prisma.course.delete({where:{id:course.id}});
  const orphan=(await controller.plans(req(owner),workspaceId))[0]!;
  assert.equal(orphan.courseId,null);
  assert.equal(orphan.courseRestricted,true);
  await assert.rejects(()=>controller.issue(req(owner),workspaceId,plan.id,{
   studentUserId:student.id,requestId:randomUUID(),
  }),ConflictException);
  await assert.rejects(()=>controller.redeem(req(student),workspaceId,{
   bookingId:booking.id,entitlementId:grant.id,
  }),ForbiddenException);
  assert.equal((await controller.mine(req(student),workspaceId))[0]?.remaining,4);
 }finally{
  if(workspaceId)await prisma.workspace.delete({where:{id:workspaceId}});
  await prisma.user.deleteMany({where:{id:{in:[owner.id,student.id]}}});
  await prisma.$disconnect();
 }
});

test('academy credit audit and revocation require management permissions and preserve future bookings',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,13);
 const people=await Promise.all([
  prisma.user.create({data:{name:'Manager',email:'audit-manager-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Student',email:'audit-student-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Foreign',email:'audit-foreign-'+nonce+'@example.invalid'}}),
 ]);
 const [owner,student,foreign]=people;
 const ids:string[]=[];
 try{
  const school=await prisma.workspace.create({data:{
   slug:'audit-school-'+nonce,name:'Audit School',type:'ACADEMY',
   members:{create:[{userId:owner!.id,role:'OWNER'},{userId:student!.id,role:'STUDENT'}]},
  }});
  ids.push(school.id);
  const other=await prisma.workspace.create({data:{
   slug:'audit-other-'+nonce,name:'Other School',type:'SOLO',
   members:{create:{userId:foreign!.id,role:'OWNER'}},
  }});
  ids.push(other.id);
  const course=await prisma.course.create({data:{workspaceId:school.id,title:'Ciencias'}}); 
  await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
  const time=new Date(Date.now()+5*86400000);
  const session=await prisma.classSession.create({data:{
   workspaceId:school.id,courseId:course.id,title:'Física',mode:'ONLINE',
   status:'CONFIRMED',timezone:'America/Bogota',capacity:3,
   startsAt:time,endsAt:new Date(time.getTime()+3600000),
  }});
  const packages=new ClassPackagesController(
   new ClassPackagesUseCases(new PrismaClassPackagesRepository(),new PrismaMembershipAdapter()),
  );
  const bookings=new BookingActionsController(
   new BookingUseCases(new PrismaBookingRepository(),new PrismaMembershipAdapter()),
  );
  const plan=await packages.create(req(owner!),school.id,{
   title:'Dos sesiones de física',courseId:course.id,
   sessionCredits:2,validDays:30,priceCOP:45000,
  });
  const grant=await packages.issue(req(owner!),school.id,plan.id,{
   studentUserId:student!.id,requestId:randomUUID(),note:'Aprobado tras comprobante externo',
  });
  await assert.rejects(()=>packages.issuances(req(student!),school.id),ForbiddenException);
  await assert.rejects(()=>packages.revoke(req(student!),school.id,grant.id,{
   reason:'Sin permiso',
  }),ForbiddenException);
  assert.equal((await packages.issuances(req(foreign!),other.id)).length,0);
  await assert.rejects(()=>packages.revoke(req(foreign!),other.id,grant.id,{
   reason:'Motivo sin acceso',
  }),NotFoundException);
  const reservation=await bookings.reserve(req(student!),school.id,{sessionId:session.id});
  await packages.redeem(req(student!),school.id,{
   entitlementId:grant.id,bookingId:reservation.id,
  });
  const activeLedger=(await packages.issuances(req(owner!),school.id))[0]!;
  assert.equal(activeLedger.student.name,'Student');
  assert.equal(activeLedger.issuer.name,'Manager');
  assert.equal(activeLedger.used,1);
  assert.equal(activeLedger.futureBookings,1);
  await assert.rejects(()=>packages.revoke(req(owner!),school.id,grant.id,{
   reason:'Corregir paquete',
  }),ConflictException);
  assert.equal((await packages.mine(req(student!),school.id))[0]?.available,1);
  await bookings.cancel(req(student!),school.id,reservation.id);
  assert.equal((await packages.issuances(req(owner!),school.id))[0]?.futureBookings,0);
  const result=await packages.revoke(req(owner!),school.id,grant.id,{
   reason:'Corrección administrativa autorizada',
  });
  assert.equal(result.revokeReason,'Corrección administrativa autorizada');
  const repeat=await packages.revoke(req(owner!),school.id,grant.id,{
   reason:'Otro motivo no debe sobrescribir el original',
  });
  assert.equal(repeat.revokeReason,result.revokeReason);
  const audited=(await packages.issuances(req(owner!),school.id))[0]!;
  assert.equal(audited.revokedByUserId,owner!.id);
  assert.equal(audited.revokeReason,result.revokeReason);
  assert.equal(audited.available,0);
  assert.equal(await prisma.notification.count({where:{
   workspaceId:school.id,userId:student!.id,kind:'PACKAGE_REVOKED',
  }}),1);
  const unused=await packages.mine(req(student!),school.id);
  assert.equal(unused[0]?.remaining,2);
  assert.equal(unused[0]?.available,0,'unused does not mean spendable after revocation');
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:ids}}});
  await prisma.user.deleteMany({where:{id:{in:people.map(p=>p.id)}}});
  await prisma.$disconnect();
 }
});
