import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {StudentProgressUseCases} from '../modules/learning/application/student-progress-use-cases.js';
import {PrismaStudentProgressRepository} from '../modules/learning/infrastructure/prisma-student-progress-repository.js';
import {StudentProgressController} from '../modules/learning/presentation/student-progress.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string;name:string}):AuthenticatedRequest{
 return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
test('group reinforcement is derived from actual teacher evidence and goals, not AI guesses',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,12);
 const people=await Promise.all([
  prisma.user.create({data:{name:'Owner',email:'insight-owner-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Teacher',email:'insight-teacher-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Another teacher',email:'insight-other-'+nonce+'@example.invalid'}}),
  ...[1,2,3].map(i=>prisma.user.create({
   data:{name:'Student '+i,email:'insight-student'+i+'-'+nonce+'@example.invalid'},
  })),
 ]);
 const [owner,teacher,otherTeacher,...students]=people;
 let workspaceId='';
 try{
  const school=await prisma.workspace.create({data:{
   slug:'insight-'+nonce,name:'Learning Insights School',type:'ACADEMY',
   members:{create:[
    {userId:owner!.id,role:'OWNER'},
    {userId:teacher!.id,role:'TEACHER'},
    {userId:otherTeacher!.id,role:'TEACHER'},
    ...students.map(user=>({userId:user.id,role:'STUDENT' as const})),
   ]},
  }});
  workspaceId=school.id;
  const [profile,course]=await Promise.all([
   prisma.teacherProfile.create({data:{workspaceId:school.id,userId:teacher!.id}}),
   prisma.course.create({data:{workspaceId:school.id,title:'Inglés B1'}}),
  ]);
  await prisma.courseTeacher.create({data:{courseId:course.id,teacherId:profile.id}});
  await prisma.enrollment.createMany({data:students.map(s=>({courseId:course.id,userId:s.id}))});
  const topic=await prisma.topic.create({data:{courseId:course.id,title:'Past simple',order:1}});
  const api=new StudentProgressController(
   new StudentProgressUseCases(new PrismaStudentProgressRepository(),new PrismaMembershipAdapter()),
  );
  const createdGoals=[];
  for(let index=0;index<students.length;index++){
   const student=students[index]!;
   const goal=await api.createGoal(req(teacher!),school.id,{
    courseId:course.id,topicId:topic.id,studentUserId:student.id,
    title:'Formular preguntas en pasado simple',targetMastery:80,
   });
   createdGoals.push(goal);
   const scores=[52,65,93];
   await api.evidence(req(teacher!),school.id,{
    topicId:topic.id,studentUserId:student.id,
    requestId:randomUUID(),score:scores[index],
    note:'Resolvió ejercicios de pasado simple ante el docente.',
   });
  }
  const insights=await api.insights(req(teacher!),school.id,course.id);
  assert.equal(insights.insights.length,1);
  assert.equal(insights.insights[0]?.topicTitle,'Past simple');
  assert.equal(insights.insights[0]?.belowTargetCount,2);
  assert.equal(insights.insights[0]?.awaitingEvidenceCount,0);
  assert.equal(insights.insights[0]?.action,'PREPARE_REINFORCEMENT');
  await assert.rejects(()=>api.insights(req(students[0]!),school.id,course.id),ForbiddenException);
  await assert.rejects(()=>api.insights(req(otherTeacher!),school.id,course.id),ForbiddenException);
  await assert.rejects(()=>api.insights(req(owner!),school.id,'course-foreign'),NotFoundException);
  await api.changeGoal(req(teacher!),school.id,createdGoals[1]!.id,{
   status:'CANCELLED',reason:'Se suspendió este objetivo del curso',
  });
  const after=await api.insights(req(teacher!),school.id,course.id);
  assert.equal(after.insights.length,0);
 }finally{
  if(workspaceId)await prisma.workspace.delete({where:{id:workspaceId}});
  await prisma.user.deleteMany({where:{id:{in:people.map(user=>user.id)}}});
  await prisma.$disconnect();
 }
});
