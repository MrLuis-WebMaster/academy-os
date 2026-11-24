import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {PrismaCalendarExport} from '../modules/integrations/infrastructure/prisma-calendar-export.js';
import {PrismaStudentClassroomRead} from '../modules/classroom/infrastructure/prisma-student-classroom-read.js';

test('PostgreSQL: Meet publication compares the authorized snapshot and exposes links only with active bookings',async()=>{
 const nonce=randomUUID().slice(0,12);
 const owner=await prisma.user.create({data:{email:'meet-owner-'+nonce+'@example.invalid',name:'Owner'}});
 const student=await prisma.user.create({data:{email:'meet-student-'+nonce+'@example.invalid',name:'Student'}});
 const teacher=await prisma.user.create({data:{email:'meet-teacher-'+nonce+'@example.invalid',name:'Teacher'}});
 const workspaceIds:string[]=[];
 try{
  const academy=await prisma.workspace.create({data:{name:'Meet Academy',slug:'meet-'+nonce,type:'ACADEMY',members:{create:[
   {userId:owner.id,role:'OWNER'},{userId:student.id,role:'STUDENT'},{userId:teacher.id,role:'TEACHER'},
  ]}}});
  workspaceIds.push(academy.id);
  const other=await prisma.workspace.create({data:{name:'Other academy',slug:'other-meet-'+nonce,type:'ACADEMY'}});
  workspaceIds.push(other.id);
  const course=await prisma.course.create({data:{workspaceId:academy.id,title:'English'}});
  const profile=await prisma.teacherProfile.create({data:{workspaceId:academy.id,userId:owner.id}});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student.id}});
  const lesson=await prisma.classSession.create({data:{
   workspaceId:academy.id,courseId:course.id,teacherProfileId:profile.id,title:'Virtual class',mode:'ONLINE',status:'CONFIRMED',
   startsAt:new Date(Date.now()+3600_000),endsAt:new Date(Date.now()+7200_000),timezone:'America/Bogota',
   meetingUrl:'https://example.test/manual',provider:'CUSTOM',
  }});
  await prisma.externalConnection.create({data:{workspaceId:academy.id,userId:owner.id,provider:'GOOGLE_CALENDAR',encryptedCredentials:'fake-ciphertext'}});
  await prisma.externalConnection.create({data:{workspaceId:academy.id,userId:teacher.id,provider:'GOOGLE_CALENDAR',encryptedCredentials:'fake-ciphertext'}});
  const repo=new PrismaCalendarExport();
  assert.equal(await repo.snapshot(other.id,owner.id,lesson.id),null);
  assert.equal(await repo.snapshot(academy.id,teacher.id,lesson.id),null);
  assert.equal(await repo.snapshot(academy.id,student.id,lesson.id),null);
  const snapshot=await repo.snapshot(academy.id,owner.id,lesson.id);
  assert.ok(snapshot);
  const url='https://meet.google.com/abc-defg-hij';
  assert.equal(await repo.publishMeet(academy.id,teacher.id,snapshot,url),false);
  assert.equal(await repo.publishMeet(academy.id,owner.id,snapshot,url),true);
  assert.equal(await repo.publishMeet(academy.id,owner.id,snapshot,'https://meet.google.com/xyz-abcd-efg'),false);
  const classroom=new PrismaStudentClassroomRead();
  const read=async()=> (await classroom.forStudent(academy.id,student.id))[0]?.course.sessions[0]?.meetingUrl;
  assert.equal(await read(),null);
  const booking=await prisma.classBooking.create({data:{workspaceId:academy.id,sessionId:lesson.id,userId:student.id}});
  assert.equal(await read(),url);
  await prisma.classBooking.update({where:{id:booking.id},data:{status:'CANCELLED'}});
  assert.equal(await read(),null);
  const fresh=await repo.snapshot(academy.id,owner.id,lesson.id);
  assert.ok(fresh);
  await prisma.classSession.update({where:{id:lesson.id},data:{status:'CANCELLED'}});
  assert.equal(await repo.publishMeet(academy.id,owner.id,fresh,url),false);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
  await prisma.user.deleteMany({where:{id:{in:[owner.id,student.id,teacher.id]}}});
  await prisma.$disconnect();
 }
});
