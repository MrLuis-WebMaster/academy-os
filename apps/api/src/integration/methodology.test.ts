import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {TeacherMethodologyUseCases} from '../modules/learning/application/methodology-use-cases.js';
import {PrismaMethodologyRepository} from '../modules/learning/infrastructure/prisma-methodology-repository.js';
import {TeachingMethodologyController} from '../modules/learning/presentation/methodology.controller.js';
import {PrismaStudentTutorRepository} from '../modules/learning/infrastructure/prisma-student-tutor-repository.js';
import {AskProfeSosUseCase,TutorDisabledByTeacher} from '../modules/learning/application/ask-profe-sos-use-case.js';
import type {TutorProvider} from '../modules/learning/application/tutor-ports.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string;name:string}):AuthenticatedRequest{
 return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
test('multi-professor methodology: workspace isolation, teacher ownership and explicit SOS enablement',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,13);
 const users=await Promise.all([
  prisma.user.create({data:{name:'Owner',email:'method-owner-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Teacher One',email:'method-teacher1-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Teacher Two',email:'method-teacher2-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Student',email:'method-student-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Other owner',email:'method-foreign-'+nonce+'@example.invalid'}}),
 ]);
 const [owner,teacherOne,teacherTwo,student,foreign]=users;
 const workspaceIds:string[]=[];
 try{
  const academy=await prisma.workspace.create({data:{
   slug:'method-academy-'+nonce,name:'Teaching academy',type:'ACADEMY',
   members:{create:[
    {userId:owner!.id,role:'OWNER'}, {userId:teacherOne!.id,role:'TEACHER'},
    {userId:teacherTwo!.id,role:'TEACHER'}, {userId:student!.id,role:'STUDENT'},
   ]},
  }});
  workspaceIds.push(academy.id);
  const other=await prisma.workspace.create({data:{
   slug:'method-other-'+nonce,name:'Another academy',type:'SOLO',
   members:{create:{userId:foreign!.id,role:'OWNER'}},
  }});
  workspaceIds.push(other.id);
  const [teacherA,teacherB,otherTeacher]=await Promise.all([
   prisma.teacherProfile.create({data:{workspaceId:academy.id,userId:teacherOne!.id}}),
   prisma.teacherProfile.create({data:{workspaceId:academy.id,userId:teacherTwo!.id}}),
   prisma.teacherProfile.create({data:{workspaceId:other.id,userId:foreign!.id}}),
  ]);
  const course=await prisma.course.create({data:{workspaceId:academy.id,title:'Matemáticas'}}); 
  await prisma.courseTeacher.create({data:{courseId:course.id,teacherId:teacherA.id}});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
  const session=await prisma.classSession.create({data:{
   workspaceId:academy.id,courseId:course.id,teacherProfileId:teacherA.id,
   title:'Números racionales',mode:'ONLINE',status:'COMPLETED',
   timezone:'America/Bogota',startsAt:new Date(Date.now()-7200000),
   endsAt:new Date(Date.now()-3600000),
  }});
  await prisma.classReflection.create({data:{
   sessionId:session.id,status:'PUBLISHED',
   approvedAt:new Date(),notes:'Aprendimos a comparar fracciones positivas usando denominadores.',
  }});
  const config=new TeachingMethodologyController(
   new TeacherMethodologyUseCases(new PrismaMethodologyRepository(),new PrismaMembershipAdapter()),
  );
  assert.equal((await config.read(req(teacherOne!),academy.id,teacherA.id)).sosEnabled,false);
  await assert.rejects(()=>config.read(req(teacherTwo!),academy.id,teacherA.id),ForbiddenException);
  await assert.rejects(()=>config.read(req(owner!),academy.id,otherTeacher.id),NotFoundException);
  const method={specialty:'MATHEMATICS',style:'STEP_BY_STEP',language:'es',
   guidance:'Antes de la solución, comprueba el primer paso del alumno.',sosEnabled:true};
  await assert.rejects(()=>config.save(req(teacherTwo!),academy.id,teacherA.id,method),ForbiddenException);
  await assert.rejects(()=>config.save(req(foreign!),other.id,teacherA.id,method),NotFoundException);
  const repo=new PrismaStudentTutorRepository();
  assert.equal((await repo.methodForCourse(academy.id,course.id)).sosEnabled,false);
  let called=0;
  const provider:TutorProvider={
   model:'mock-teaching-method',available:()=>true,
   answer:async(question,evidence,actualMethod)=>{
    called++;
    assert.equal(question,'¿Cómo comparo dos fracciones?');
    assert.equal(evidence.length,1);
    assert.equal(actualMethod.style,'STEP_BY_STEP');
    return {answer:'Compáralas usando denominadores comunes y verifica cada paso.',evidenceIds:[session.id],referToTeacher:false};
   },
  };
  const tutor=new AskProfeSosUseCase(repo,new PrismaMembershipAdapter(),provider);
  await assert.rejects(()=>tutor.execute(academy.id,student!.id,{
   courseId:course.id,question:'¿Cómo comparo dos fracciones?',approveExternalProcessing:true,
  }),TutorDisabledByTeacher);
  assert.equal(called,0);
  assert.equal((await config.save(req(teacherOne!),academy.id,teacherA.id,method)).sosEnabled,true);
  assert.equal((await repo.methodForCourse(academy.id,course.id)).specialty,'MATHEMATICS');
  assert.equal((await tutor.execute(academy.id,student!.id,{
   courseId:course.id,question:'¿Cómo comparo dos fracciones?',approveExternalProcessing:true,
  })).sources[0]?.id,session.id);
  assert.equal(called,1);
  assert.equal(await prisma.aiGeneration.count({where:{workspaceId:other.id}}),0);
  await config.save(req(owner!),academy.id,teacherA.id,{...method,sosEnabled:false});
  await assert.rejects(()=>tutor.execute(academy.id,student!.id,{
   courseId:course.id,question:'¿Cómo comparo dos fracciones?',approveExternalProcessing:true,
  }),TutorDisabledByTeacher);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
  await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
  await prisma.$disconnect();
 }
});
