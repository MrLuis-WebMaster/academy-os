import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ConflictException,ForbiddenException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {HolidayPolicyUseCases} from '../modules/scheduling/application/holiday-policy-use-cases.js';
import {PrismaHolidayPolicyRepository} from '../modules/scheduling/infrastructure/prisma-holiday-policy-repository.js';
import {HolidayPolicyController} from '../modules/scheduling/presentation/holiday-policy.controller.js';
import {LessonUseCases} from '../modules/scheduling/application/lesson-use-cases.js';
import {PrismaLessonRepository} from '../modules/scheduling/infrastructure/prisma-lesson-repository.js';
import {LessonsController} from '../modules/scheduling/presentation/lessons.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string}):AuthenticatedRequest {
 return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL holiday policy is tenant-owned, opt-in and applied to new lessons',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,12);
 const [owner,teacher,foreign]=await Promise.all([
  prisma.user.create({data:{email:'holidays-owner-'+nonce+'@example.invalid',name:'Owner'}}),
  prisma.user.create({data:{email:'holidays-teacher-'+nonce+'@example.invalid',name:'Teacher'}}),
  prisma.user.create({data:{email:'holidays-foreign-'+nonce+'@example.invalid',name:'Foreign'}}),
 ]);
 const workspaceIds:string[]=[];
 try{
  const workspace=await prisma.workspace.create({data:{
   slug:'holidays-'+nonce,name:'Holiday Academy',type:'ACADEMY',timezone:'America/Bogota',
   members:{create:[
    {userId:owner.id,role:'OWNER'},{userId:teacher.id,role:'TEACHER'},
   ]},
  }});
  workspaceIds.push(workspace.id);
  const unrelated=await prisma.workspace.create({data:{
   slug:'holidays-foreign-'+nonce,name:'Other Holiday Academy',type:'ACADEMY',
   members:{create:{userId:foreign.id,role:'OWNER'}},
  }});
  workspaceIds.push(unrelated.id);
  const profile=await prisma.teacherProfile.create({
   data:{workspaceId:workspace.id,userId:teacher.id},
  });
  const calendar=new HolidayPolicyController(
   new HolidayPolicyUseCases(new PrismaHolidayPolicyRepository(),new PrismaMembershipAdapter()),
  );
  const lessons=new LessonsController(
   new LessonUseCases(new PrismaLessonRepository(),new PrismaMembershipAdapter()),
  );
  assert.equal((await calendar.settings(req(owner),workspace.id)).avoidPublicHolidays,false);
  const coming=await calendar.calendar(req(teacher),workspace.id,'2027');
  assert.equal(coming.holidays.some(day=>day.date==='2027-12-08'),true);
  await assert.rejects(()=>calendar.update(req(teacher),workspace.id,{
   avoidPublicHolidays:true,
  }),ForbiddenException);
  await assert.rejects(()=>calendar.update(req(foreign),workspace.id,{
   avoidPublicHolidays:true,
  }),ForbiddenException);

  const holidayLesson={
   title:'Revisión de temas',teacherProfileId:profile.id,mode:'ONLINE',
   startsAt:'2027-12-08T15:00:00Z',endsAt:'2027-12-08T16:00:00Z',
   capacity:2,meetingUrl:'https://meet.example.invalid/holiday',
  };
  const allowed=await lessons.create(req(owner),workspace.id,holidayLesson);
  assert.equal(allowed.status,'CONFIRMED');
  await calendar.update(req(owner),workspace.id,{avoidPublicHolidays:true});
  const next={...holidayLesson,startsAt:'2027-12-08T18:00:00Z',endsAt:'2027-12-08T19:00:00Z'};
  await assert.rejects(()=>lessons.create(req(owner),workspace.id,next),ConflictException);
  const normal={
   ...holidayLesson,startsAt:'2027-12-09T15:00:00Z',endsAt:'2027-12-09T16:00:00Z',
  };
  assert.equal((await lessons.create(req(owner),workspace.id,normal)).status,'CONFIRMED');
  assert.equal(await prisma.classSession.count({where:{workspaceId:workspace.id}}),2);
  assert.equal((await calendar.settings(req(foreign),unrelated.id)).avoidPublicHolidays,false);
  await calendar.update(req(owner),workspace.id,{holidayCountry:'NONE',avoidPublicHolidays:false});
  assert.equal((await calendar.calendar(req(owner),workspace.id,'2027')).holidays.length,0);
  assert.equal((await calendar.settings(req(foreign),unrelated.id)).holidayCountry,'CO');
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
  await prisma.user.deleteMany({where:{id:{in:[owner.id,teacher.id,foreign.id]}}});
  await prisma.$disconnect();
 }
});
