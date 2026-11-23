import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ForbiddenException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {AnalyticsUseCases} from '../modules/analytics/application/analytics-use-cases.js';
import {PrismaAnalyticsRepository} from '../modules/analytics/infrastructure/prisma-analytics-repository.js';
import {AnalyticsController} from '../modules/analytics/presentation/analytics.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string;name:string}):AuthenticatedRequest{
 return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL analytics: count only real events within the current academy and window',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,13);
 const people=await Promise.all([
  prisma.user.create({data:{email:'metric-owner-'+nonce+'@example.invalid',name:'Owner A'}}),
  prisma.user.create({data:{email:'metric-admin-'+nonce+'@example.invalid',name:'Admin A'}}),
  prisma.user.create({data:{email:'metric-student-'+nonce+'@example.invalid',name:'Student A'}}),
  prisma.user.create({data:{email:'metric-foreign-'+nonce+'@example.invalid',name:'Owner B'}}),
 ]);
 const [owner,admin,student,foreign]=people;
 const workspaces:string[]=[];
 try{
  const a=await prisma.workspace.create({data:{
   slug:'metric-a-'+nonce,name:'Metric academy',type:'ACADEMY',
   members:{create:[
    {userId:owner!.id,role:'OWNER'},
    {userId:admin!.id,role:'ADMIN'},
    {userId:student!.id,role:'STUDENT'},
   ]},
  }});
  workspaces.push(a.id);
  const b=await prisma.workspace.create({data:{
   slug:'metric-b-'+nonce,name:'Other academy',type:'ACADEMY',
   members:{create:{userId:foreign!.id,role:'OWNER'}},
  }});
  workspaces.push(b.id);
  const [course,foreignCourse,teacher]=await Promise.all([
   prisma.course.create({data:{workspaceId:a.id,title:'Curso A'}}),
   prisma.course.create({data:{workspaceId:b.id,title:'Curso B'}}),
   prisma.teacherProfile.create({data:{workspaceId:a.id,userId:owner!.id}}),
  ]);
  // Historical reporting window: only lesson starts inside the last 30 days count.
  const tomorrow=new Date(Date.now()-12*3600000);
  const nextWeek=new Date(Date.now()-4*86400000);
  const old=new Date(Date.now()-100*86400000);
  const sessions=await Promise.all([
   prisma.classSession.create({data:{
    workspaceId:a.id,courseId:course.id,teacherProfileId:teacher.id,
    title:'Lesson A',status:'CONFIRMED',mode:'ONLINE',timezone:'America/Bogota',
    startsAt:tomorrow,endsAt:new Date(tomorrow.getTime()+3600000),
   }}),
   prisma.classSession.create({data:{
    workspaceId:a.id,courseId:course.id,teacherProfileId:teacher.id,
    title:'Lesson B',status:'COMPLETED',mode:'ONLINE',timezone:'America/Bogota',
    startsAt:new Date(Date.now()-86400000),endsAt:new Date(Date.now()-86400000+3600000),
   }}),
   prisma.classSession.create({data:{
    workspaceId:b.id,courseId:foreignCourse.id,
    title:'Foreign lesson',status:'CONFIRMED',mode:'ONLINE',timezone:'America/Bogota',
    startsAt:nextWeek,endsAt:new Date(nextWeek.getTime()+3600000),
   }}),
   prisma.classSession.create({data:{
    workspaceId:a.id,courseId:course.id,teacherProfileId:teacher.id,
    title:'Old lesson',status:'COMPLETED',mode:'ONLINE',timezone:'America/Bogota',
    startsAt:old,endsAt:new Date(old.getTime()+3600000),
   }}),
  ]);
  await prisma.classBooking.create({data:{
   workspaceId:a.id,sessionId:sessions[0]!.id,userId:student!.id,
   status:'BOOKED',
  }});
  await prisma.paymentReceipt.create({data:{
   workspaceId:a.id,courseId:course.id,studentUserId:student!.id,
   recordedByUserId:owner!.id,amountCOP:50000,method:'CASH',
  }});
  const service=new AnalyticsController(
   new AnalyticsUseCases(new PrismaAnalyticsRepository(),new PrismaMembershipAdapter()),
  );
  await assert.rejects(()=>service.overview(req(student!),a.id,'30d'),ForbiddenException);
  await assert.rejects(()=>service.overview(req(foreign!),a.id,'30d'),ForbiddenException);
  const dashboard=await service.overview(req(owner!),a.id,'30d');
  assert.equal(dashboard.people.students,1);
  assert.equal(dashboard.people.teachers,1);
  assert.equal(dashboard.people.courses,1);
  assert.equal(dashboard.classes.scheduled,1);
  assert.equal(dashboard.classes.completed,1);
  assert.equal(dashboard.classes.bookedSeats,1);
  assert.equal(dashboard.finances.manualCollectedCOP,50000);
  assert.equal(dashboard.learning.practiceAttempts,0);
  assert.equal(dashboard.learning.averagePracticeScore,null);
  const adminView=await service.overview(req(admin!),a.id,'30d');
  assert.deepEqual(adminView.people,dashboard.people);
  const foreignReport=await service.overview(req(foreign!),b.id,'30d');
  assert.equal(foreignReport.people.students,0);
  assert.equal(foreignReport.classes.scheduled,1);
  assert.equal(foreignReport.finances.manualCollectedCOP,0);
  assert.equal(JSON.stringify(foreignReport).includes(student!.email),false);
  const short=await service.overview(req(owner!),a.id,'7d');
  assert.equal(short.classes.scheduled,1);
  assert.equal(short.classes.completed,1);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaces}}});
  await prisma.user.deleteMany({where:{id:{in:people.map(p=>p.id)}}});
  await prisma.$disconnect();
 }
});
