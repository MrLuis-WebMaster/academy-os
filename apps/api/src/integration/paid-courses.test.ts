import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ConflictException,ForbiddenException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {CoursesController} from '../modules/academics/presentation/courses.controller.js';
import {CourseUseCases} from '../modules/academics/application/course-use-cases.js';
import {PrismaCourseRepository} from '../modules/academics/infrastructure/prisma-course-repository.js';
import {BookingActionsController} from '../modules/scheduling/presentation/booking-actions.controller.js';
import {BookingUseCases} from '../modules/scheduling/application/booking-use-cases.js';
import {PrismaBookingRepository} from '../modules/scheduling/infrastructure/prisma-booking-repository.js';
import {SeriesBookingsController} from '../modules/scheduling/presentation/series-bookings.controller.js';
import {SeriesBookingUseCases} from '../modules/scheduling/application/series-booking-use-cases.js';
import {PrismaSeriesBookingRepository} from '../modules/scheduling/infrastructure/prisma-series-booking-repository.js';
import {ClassPackagesController} from '../modules/commerce/presentation/packages.controller.js';
import {ClassPackagesUseCases} from '../modules/commerce/application/package-use-cases.js';
import {PrismaClassPackagesRepository} from '../modules/commerce/infrastructure/prisma-class-packages-repository.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;name:string;email:string}):AuthenticatedRequest{
 return {academyUser:{id:user.id,name:user.name,email:user.email}} as unknown as AuthenticatedRequest;
}
function controllers(){
 const membership=new PrismaMembershipAdapter();
 return {
  courses:new CoursesController(new CourseUseCases(new PrismaCourseRepository(),membership)),
  bookings:new BookingActionsController(new BookingUseCases(new PrismaBookingRepository(),membership)),
  packages:new ClassPackagesController(new ClassPackagesUseCases(new PrismaClassPackagesRepository(),membership)),
  series:new SeriesBookingsController(new SeriesBookingUseCases(new PrismaSeriesBookingRepository(),membership)),
 };
}
test('paid course reservation debits one granted credit atomically; free courses stay free',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,13);
 const people=await Promise.all([
  prisma.user.create({data:{name:'Manager',email:'paid-manager-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Student',email:'paid-student-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Other manager',email:'paid-foreign-'+nonce+'@example.invalid'}}),
 ]);
 const [owner,student,foreign]=people;
 const workspaceIds:string[]=[];
 try{
  const workspace=await prisma.workspace.create({data:{
   slug:'paid-'+nonce,name:'English Academy',type:'ACADEMY',
   members:{create:[{userId:owner!.id,role:'OWNER'},{userId:student!.id,role:'STUDENT'}]},
  }});
  workspaceIds.push(workspace.id);
  const other=await prisma.workspace.create({data:{
   slug:'paid-other-'+nonce,name:'Other Academy',type:'ACADEMY',
   members:{create:{userId:foreign!.id,role:'OWNER'}},
  }});
  workspaceIds.push(other.id);
  const course=await prisma.course.create({data:{workspaceId:workspace.id,title:'Speaking intensive'}});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
  const starts=new Date(Date.now()+3*86400000);
  const sessions=await Promise.all([0,1,2].map(i=>prisma.classSession.create({data:{
   workspaceId:workspace.id,courseId:course.id,title:'Speaking '+i,status:'CONFIRMED',
   mode:'ONLINE',timezone:'America/Bogota',capacity:2,
   startsAt:new Date(starts.getTime()+i*86400000),
   endsAt:new Date(starts.getTime()+i*86400000+3600000),
  }})));
  const {courses,bookings,packages}=controllers();
  assert.equal((await courses.list(req(owner!),workspace.id))[0]?.requiresPackage,false);
  assert.equal((await courses.packagePolicy(req(owner!),workspace.id,course.id,{requiresPackage:true})).requiresPackage,true);
  await assert.rejects(()=>courses.packagePolicy(req(student!),workspace.id,course.id,{requiresPackage:false}),ForbiddenException);
  await assert.rejects(()=>courses.packagePolicy(req(foreign!),other.id,course.id,{requiresPackage:true}),ForbiddenException);
  await assert.rejects(()=>bookings.reserve(req(student!),workspace.id,{sessionId:sessions[0]!.id}),ConflictException);
  assert.equal(await prisma.classBooking.count({where:{workspaceId:workspace.id}}),0,'failed credit check must roll back the booking');

  const plan=await packages.create(req(owner!),workspace.id,{
   title:'Una clase de conversación',sessionCredits:1,validDays:30,priceCOP:30000,
   courseId:course.id,
  });
  const issued=await packages.issue(req(owner!),workspace.id,plan.id,{
   studentUserId:student!.id,requestId:randomUUID(),
  });
  const competition=await Promise.allSettled([
   bookings.reserve(req(student!),workspace.id,{sessionId:sessions[0]!.id}),
   bookings.reserve(req(student!),workspace.id,{sessionId:sessions[1]!.id}),
  ]);
  assert.equal(competition.filter(r=>r.status==='fulfilled').length,1);
  assert.ok(competition.some(r=>r.status==='rejected'&&r.reason instanceof ConflictException));
  const successful=competition[0]?.status==='fulfilled'?sessions[0]!:sessions[1]!;
  const denied=successful.id===sessions[0]!.id?sessions[1]!:sessions[0]!;
  const active=await prisma.classBooking.findFirstOrThrow({
   where:{workspaceId:workspace.id,userId:student!.id,sessionId:successful.id},
  });
  assert.equal(await prisma.classPackageRedemption.count({
   where:{entitlementId:issued.id,refundedAt:null},
  }),1);
  assert.equal((await packages.mine(req(student!),workspace.id))[0]?.available,0);
  assert.equal((await bookings.reserve(req(student!),workspace.id,{sessionId:successful.id})).alreadyBooked,true);
  assert.equal(await prisma.classPackageRedemption.count({
   where:{entitlementId:issued.id,refundedAt:null},
  }),1);
  await bookings.cancel(req(student!),workspace.id,active.id);
  await bookings.cancel(req(student!),workspace.id,active.id);
  assert.equal((await packages.mine(req(student!),workspace.id))[0]?.available,1);
  const reservation=await bookings.reserve(req(student!),workspace.id,{sessionId:denied.id});
  assert.equal(reservation.alreadyBooked,false);
  assert.equal((await packages.mine(req(student!),workspace.id))[0]?.available,0);
  // Policy cannot flip back on while an existing future reservation lacks credit.
  await courses.packagePolicy(req(owner!),workspace.id,course.id,{requiresPackage:false});
  const freeBooking=await bookings.reserve(req(student!),workspace.id,{sessionId:successful.id});
  assert.equal(freeBooking.alreadyBooked,false);
  assert.equal(await prisma.classPackageRedemption.count({
   where:{bookingId:freeBooking.id,refundedAt:null},
  }),0);
  await assert.rejects(()=>courses.packagePolicy(req(owner!),workspace.id,course.id,{requiresPackage:true}),ConflictException);
  await bookings.cancel(req(student!),workspace.id,freeBooking.id);
  assert.equal((await courses.packagePolicy(req(owner!),workspace.id,course.id,{requiresPackage:true})).requiresPackage,true);
  await assert.rejects(()=>bookings.reserve(req(student!),workspace.id,{sessionId:sessions[2]!.id}),ConflictException);
  await bookings.cancel(req(student!),workspace.id,reservation.id);
  assert.equal((await packages.mine(req(student!),workspace.id))[0]?.available,1);
  assert.equal((await bookings.reserve(req(student!),workspace.id,{sessionId:sessions[2]!.id})).alreadyBooked,false);
  assert.equal(await prisma.classPackageRedemption.count({
   where:{booking:{workspaceId:other.id}},
  }),0);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
  await prisma.user.deleteMany({where:{id:{in:people.map(p=>p.id)}}});
  await prisma.$disconnect();
 }
});

test('paid recurring series commits all classes and credits or neither',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,13);
 const people=await Promise.all([
  prisma.user.create({data:{name:'Manager',email:'paid-series-owner-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Student',email:'paid-series-student-'+nonce+'@example.invalid'}}),
 ]);
 const [owner,student]=people;
 let workspaceId='';
 try{
  const workspace=await prisma.workspace.create({data:{
   slug:'paid-series-'+nonce,name:'Music Academy',type:'ACADEMY',
   members:{create:[{userId:owner.id,role:'OWNER'},{userId:student.id,role:'STUDENT'}]},
  }});
  workspaceId=workspace.id;
  const course=await prisma.course.create({data:{
   workspaceId,title:'Piano lessons',requiresPackage:true,
  }});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student.id}});
  const profile=await prisma.teacherProfile.create({data:{workspaceId,userId:owner.id}});
  const start=new Date(Date.now()+5*86400000);
  start.setUTCHours(14,0,0,0);
  const series=await prisma.classSeries.create({data:{
   workspaceId,teacherProfileId:profile.id,createdByUserId:owner.id,
   firstStartsAt:start,repeatWeeks:3,timezone:'America/Bogota',
  }});
  await Promise.all([0,1,2].map(i=>{
   const startsAt=new Date(start.getTime()+i*7*86400000);
   return prisma.classSession.create({data:{
    workspaceId,seriesId:series.id,seriesIndex:i,teacherProfileId:profile.id,
    courseId:course.id,title:'Piano practice '+i,status:'CONFIRMED',
    mode:'ONLINE',timezone:'America/Bogota',capacity:5,
    startsAt,endsAt:new Date(startsAt.getTime()+3600000),
   }});
  }));
  const {packages,series:seriesActions}=controllers();
  const plan=await packages.create(req(owner),workspaceId,{
   title:'Tres clases de piano',sessionCredits:2,validDays:60,priceCOP:80000,
   courseId:course.id,
  });
  const first=await packages.issue(req(owner),workspaceId,plan.id,{
   studentUserId:student.id,requestId:randomUUID(),
  });
  await assert.rejects(()=>seriesActions.reserve(req(student),workspaceId,{seriesId:series.id}),ConflictException);
  assert.equal(await prisma.classBooking.count({where:{workspaceId,userId:student.id}}),0);
  assert.equal((await packages.mine(req(student),workspaceId))[0]?.available,2);
  const extra=await packages.issue(req(owner),workspaceId,plan.id,{
   studentUserId:student.id,requestId:randomUUID(),
  });
  const reserved=await seriesActions.reserve(req(student),workspaceId,{seriesId:series.id});
  assert.equal(reserved.booked,3);
  assert.equal(await prisma.classBooking.count({where:{workspaceId,userId:student.id,status:'BOOKED'}}),3);
  assert.equal(await prisma.classPackageRedemption.count({
   where:{entitlementId:{in:[first.id,extra.id]},refundedAt:null},
  }),3);
  assert.equal((await seriesActions.reserve(req(student),workspaceId,{seriesId:series.id})).alreadyBooked,3);
  assert.equal((await seriesActions.cancelFuture(req(student),workspaceId,series.id)).cancelledBookings,3);
  assert.equal(await prisma.classPackageRedemption.count({
   where:{entitlementId:{in:[first.id,extra.id]},refundedAt:null},
  }),0);
  assert.equal((await seriesActions.reserve(req(student),workspaceId,{seriesId:series.id})).booked,3);
 }finally{
  if(workspaceId)await prisma.workspace.delete({where:{id:workspaceId}});
  await prisma.user.deleteMany({where:{id:{in:people.map(p=>p.id)}}});
  await prisma.$disconnect();
 }
});
