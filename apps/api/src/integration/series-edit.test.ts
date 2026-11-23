import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {EditFutureSeriesUseCase} from '../modules/scheduling/application/edit-future-series.js';
import {PrismaSeriesEditRepository} from '../modules/scheduling/infrastructure/prisma-series-edit-repository.js';
import {SeriesEditController} from '../modules/scheduling/presentation/series-edit.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string}):AuthenticatedRequest {
 return {academyUser:{id:user.id,email:user.email,name:user.email}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL weekly series edits keep history, occupied seats and reschedule notices',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,14);
 const users=await Promise.all([
  prisma.user.create({data:{email:'series-edit-owner-'+nonce+'@example.invalid',name:'Owner'}}),
  prisma.user.create({data:{email:'series-edit-teacher-'+nonce+'@example.invalid',name:'Teacher'}}),
  prisma.user.create({data:{email:'series-edit-student-'+nonce+'@example.invalid',name:'Student'}}),
  prisma.user.create({data:{email:'series-edit-student2-'+nonce+'@example.invalid',name:'Student Two'}}),
  prisma.user.create({data:{email:'series-edit-foreign-'+nonce+'@example.invalid',name:'Foreign Owner'}}),
 ]);
 const [owner,teacher,student,studentTwo,foreignOwner]=users;
 const workspaceIds:string[]=[];
 try{
  const academy=await prisma.workspace.create({data:{
   slug:'series-edit-a-'+nonce,name:'Series Edit Academy',type:'ACADEMY',
   timezone:'America/Bogota',members:{create:[
    {userId:owner!.id,role:'OWNER'},
    {userId:teacher!.id,role:'TEACHER'},
    {userId:student!.id,role:'STUDENT'},
    {userId:studentTwo!.id,role:'STUDENT'},
   ]},
  }});
  workspaceIds.push(academy.id);
  const foreign=await prisma.workspace.create({data:{
   slug:'series-edit-b-'+nonce,name:'Foreign Academy',type:'ACADEMY',
   members:{create:{userId:foreignOwner!.id,role:'OWNER'}},
  }});
  workspaceIds.push(foreign.id);
  const profile=await prisma.teacherProfile.create({data:{
   workspaceId:academy.id,userId:teacher!.id,
  }});
  const course=await prisma.course.create({data:{workspaceId:academy.id,title:'Algebra'}}); 
  await prisma.enrollment.createMany({data:[
   {courseId:course.id,userId:student!.id},
   {courseId:course.id,userId:studentTwo!.id},
  ]});
  const future=new Date(Date.now()+9*86400000);
  future.setUTCHours(15,0,0,0);
  const past=new Date(Date.now()-9*86400000);
  const series=await prisma.classSeries.create({data:{
   workspaceId:academy.id,teacherProfileId:profile.id,createdByUserId:owner!.id,
   firstStartsAt:past,repeatWeeks:3,timezone:'America/Bogota',
  }});
  const history=await prisma.classSession.create({data:{
   workspaceId:academy.id,teacherProfileId:profile.id,courseId:course.id,
   seriesId:series.id,seriesIndex:0,title:'Historical class',status:'COMPLETED',
   startsAt:past,endsAt:new Date(past.getTime()+3600000),timezone:'America/Bogota',
   mode:'ONLINE',meetingUrl:'https://meet.example.invalid/abc',
  }});
  const sessions=await Promise.all([1,2].map(index=>{
   const startsAt=new Date(future.getTime()+(index-1)*7*86400000);
   return prisma.classSession.create({data:{
    workspaceId:academy.id,teacherProfileId:profile.id,courseId:course.id,
    seriesId:series.id,seriesIndex:index,title:'Before update',status:'CONFIRMED',
    startsAt,endsAt:new Date(startsAt.getTime()+3600000),timezone:'America/Bogota',
    mode:'ONLINE',capacity:2,meetingUrl:'https://meet.example.invalid/abc',
   }});
  }));
  await prisma.classBooking.createMany({data:[student!,studentTwo!].map(s=>({
   workspaceId:academy.id,sessionId:sessions[0]!.id,userId:s.id,
  }))});
  const api=new SeriesEditController(
   new EditFutureSeriesUseCase(new PrismaSeriesEditRepository(),new PrismaMembershipAdapter()),
  );
  const patch={reason:'Nuevo horario semanal acordado',title:'Grupo actualizado',capacity:3};
  await assert.rejects(()=>api.edit(req(foreignOwner!),foreign.id,series.id,patch),NotFoundException);
  await assert.rejects(()=>api.edit(req(student!),academy.id,series.id,patch),ForbiddenException);
  await assert.rejects(()=>api.edit(req(owner!),academy.id,series.id,{
   ...patch,capacity:0,
  }),BadRequestException);
  await assert.rejects(()=>api.edit(req(owner!),academy.id,series.id,{
   ...patch,capacity:1,
  }),ConflictException);
  assert.equal((await prisma.classSession.findUniqueOrThrow({
   where:{id:sessions[0]!.id},select:{title:true},
  })).title,'Before update');

  const startsAt=new Date(future.getTime()+3600000);
  const endsAt=new Date(startsAt.getTime()+3600000);
  const result=await api.edit(req(teacher!),academy.id,series.id,{
   ...patch,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),
  });
  assert.deepEqual(result,{
   seriesId:series.id,updatedSessions:2,affectedBookings:2,
   inAppNotificationsCreated:2,historicalSessionsPreserved:true,
  });
  assert.equal((await prisma.classSession.findUniqueOrThrow({
   where:{id:history.id},select:{title:true},
  })).title,'Historical class');
  const updated=await prisma.classSession.findMany({
   where:{workspaceId:academy.id,seriesId:series.id,status:'CONFIRMED'},
   orderBy:{seriesIndex:'asc'},select:{startsAt:true,title:true,capacity:true},
  });
  assert.equal(updated.length,2);
  assert.equal(updated[0]?.title,'Grupo actualizado');
  assert.equal(updated[0]?.capacity,3);
  assert.equal(updated[0]?.startsAt.toISOString(),startsAt.toISOString());
  assert.equal(updated[1]?.startsAt.toISOString(),
   new Date(startsAt.getTime()+7*86400000).toISOString());
  assert.equal(await prisma.sessionChange.count({
   where:{sessionId:{in:sessions.map(s=>s.id)}},
  }),2);
  assert.equal(await prisma.notification.count({
   where:{workspaceId:academy.id,kind:'SESSION_RESCHEDULED'},
  }),2);
  assert.equal(await prisma.classBooking.count({
   where:{workspaceId:academy.id,sessionId:sessions[0]!.id,status:'BOOKED'},
  }),2);

  await prisma.classSession.create({data:{
   workspaceId:academy.id,courseId:course.id,teacherProfileId:profile.id,
   title:'Another lesson',status:'CONFIRMED',mode:'ONLINE',
   timezone:'America/Bogota',meetingUrl:'https://meet.example.invalid/other',
   startsAt:endsAt,endsAt:new Date(endsAt.getTime()+3600000),
  }});
  await assert.rejects(()=>api.edit(req(owner!),academy.id,series.id,{
   reason:'Overlapping with existing class',
   startsAt:endsAt.toISOString(),
   endsAt:new Date(endsAt.getTime()+3600000).toISOString(),
  }),ConflictException);
  assert.equal((await prisma.classSession.findUniqueOrThrow({
   where:{id:sessions[0]!.id},select:{startsAt:true},
  })).startsAt.toISOString(),startsAt.toISOString());
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
  await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
  await prisma.$disconnect();
 }
});
