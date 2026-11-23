import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {LearningAssetsUseCases} from '../modules/learning/application/learning-assets-use-cases.js';
import {PrismaLearningAssetsRepository} from '../modules/learning/infrastructure/prisma-learning-assets-repository.js';
import {LearningAssetsController} from '../modules/learning/presentation/learning-assets.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string;name:string}):AuthenticatedRequest{
 return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL teacher assets remain private drafts until approved lesson is published',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,13);
 const people=await Promise.all([
  prisma.user.create({data:{name:'Owner',email:'asset-owner-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Teacher',email:'asset-teacher-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Other Teacher',email:'asset-otherteacher-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Student',email:'asset-student-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Other Student',email:'asset-otherstudent-'+nonce+'@example.invalid'}}),
  prisma.user.create({data:{name:'Foreign',email:'asset-foreign-'+nonce+'@example.invalid'}}),
 ]);
 const [owner,teacher,otherTeacher,student,otherStudent,foreign]=people;
 const workspaceIds:string[]=[];
 try{
  const a=await prisma.workspace.create({data:{
   slug:'asset-a-'+nonce,name:'Teacher assets',type:'ACADEMY',
   members:{create:[
    {userId:owner!.id,role:'OWNER'},
    {userId:teacher!.id,role:'TEACHER'},
    {userId:otherTeacher!.id,role:'TEACHER'},
    {userId:student!.id,role:'STUDENT'},
    {userId:otherStudent!.id,role:'STUDENT'},
   ]},
  }});
  workspaceIds.push(a.id);
  const b=await prisma.workspace.create({data:{
   slug:'asset-b-'+nonce,name:'Other academy',type:'ACADEMY',
   members:{create:{userId:foreign!.id,role:'OWNER'}},
  }});
  workspaceIds.push(b.id);
  const [teacherProfile,otherProfile,course]=await Promise.all([
   prisma.teacherProfile.create({data:{workspaceId:a.id,userId:teacher!.id}}),
   prisma.teacherProfile.create({data:{workspaceId:a.id,userId:otherTeacher!.id}}),
   prisma.course.create({data:{workspaceId:a.id,title:'Inglés'}}),
  ]);
  await prisma.courseTeacher.create({data:{courseId:course.id,teacherId:teacherProfile.id}});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
  const session=await prisma.classSession.create({data:{
   workspaceId:a.id,courseId:course.id,teacherProfileId:teacherProfile.id,
   title:'Past simple',status:'COMPLETED',mode:'ONLINE',timezone:'America/Bogota',
   startsAt:new Date(Date.now()-2*3600000),endsAt:new Date(Date.now()-3600000),
  }});
  const reflection=await prisma.classReflection.create({data:{
   sessionId:session.id,notes:'Hoy trabajamos la diferencia entre was y were.',
   status:'DRAFT',
  }});
  const api=new LearningAssetsController(
   new LearningAssetsUseCases(new PrismaLearningAssetsRepository(),new PrismaMembershipAdapter()),
  );
  const initial={
   sessionId:session.id,kind:'FLASHCARDS',title:'Verbos básicos',
   content:{cards:[
    {front:'Was in English',back:'Past form for I, he, she and it'},
    {front:'Were in English',back:'Past form for you, we and they'},
   ]},
  } as const;
  await assert.rejects(()=>api.create(req(student!),a.id,initial),ForbiddenException);
  await assert.rejects(()=>api.create(req(otherTeacher!),a.id,initial),ForbiddenException);
  await assert.rejects(()=>api.create(req(foreign!),b.id,initial),NotFoundException);
  await assert.rejects(()=>api.create(req(teacher!),a.id,{
   ...initial,content:{cards:[{front:'bad',back:'too short?'}]},
  }),BadRequestException);
  const cards=await api.create(req(teacher!),a.id,initial);
  assert.equal(cards.publishedAt,null);
  assert.equal((await api.staff(req(owner!),a.id)).length,1);
  assert.equal((await api.staff(req(otherTeacher!),a.id)).length,0);
  assert.equal((await api.student(req(student!),a.id)).length,0);
  await assert.rejects(()=>api.publish(req(teacher!),a.id,cards.id),ConflictException);
  const revised=await api.revise(req(teacher!),a.id,cards.id,{
   title:'Was y were: tarjetas',
   content:{cards:[
    {front:'Was I?',back:'Was used for the pronoun I'},
    {front:'Were you?',back:'Were used for the pronoun you'},
   ]},
  });
  assert.equal(revised.title,'Was y were: tarjetas');
  await prisma.classReflection.update({where:{id:reflection.id},data:{
   status:'PUBLISHED',approvedAt:new Date(),
  }});
  const micro=await api.create(req(owner!),a.id,{
   sessionId:session.id,kind:'MICROLESSON',title:'Microlección: afirmaciones',
   content:{
    summary:'En pasado simple usamos was y were con diferentes sujetos gramaticales.',
    steps:[{heading:'Elige tu sujeto',body:'Identifica el pronombre antes de conjugar el verbo to be.'}],
    reviewPrompt:'¿Cómo dirías en inglés que ellos estaban contentos?',
   },
  });
  assert.equal(micro.kind,'MICROLESSON');
  assert.equal((await api.student(req(student!),a.id)).length,0);
  const published=await api.publish(req(teacher!),a.id,cards.id);
  assert.ok(published.publishedAt);
  assert.equal((await api.publish(req(teacher!),a.id,cards.id)).id,cards.id);
  await assert.rejects(()=>api.revise(req(teacher!),a.id,cards.id,{
   title:'Mal cambio',content:initial.content,
  }),ConflictException);
  assert.equal((await api.student(req(student!),a.id)).length,1);
  assert.equal((await api.student(req(otherStudent!),a.id)).length,0);
  assert.equal((await api.staff(req(foreign!),b.id)).length,0);
  await assert.rejects(()=>api.publish(req(foreign!),b.id,cards.id),NotFoundException);
  await api.publish(req(owner!),a.id,micro.id);
  assert.equal((await api.student(req(student!),a.id)).length,2);
  assert.equal((await api.student(req(student!),a.id)).find(a=>a.kind==='MICROLESSON')?.title,'Microlección: afirmaciones');
  assert.equal((await prisma.learningAsset.findMany({where:{reflectionId:reflection.id}})).length,2);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
  await prisma.user.deleteMany({where:{id:{in:people.map(p=>p.id)}}});
  await prisma.$disconnect();
 }
});
