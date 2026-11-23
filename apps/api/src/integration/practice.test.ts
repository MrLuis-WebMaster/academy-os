import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {PrismaPracticeRepository} from '../modules/learning/infrastructure/prisma-practice-repository.js';
import {PracticeUseCases} from '../modules/learning/application/practice-use-cases.js';
import {PracticeController} from '../modules/learning/presentation/practice.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string}):AuthenticatedRequest{
  return {academyUser:{id:user.id,email:user.email,name:'Test'}} as unknown as AuthenticatedRequest;
}
const qs=[
  {prompt:'¿Cuánto vale x en x + 2 = 5?',options:['1','2','3','4'],correctIndex:2,explanation:'Restar 2.'},
  {prompt:'¿Cuánto vale x en 2x = 8?',options:['2','3','4','8'],correctIndex:2,explanation:'Dividir por 2.'},
];
test('PostgreSQL practice: private drafts, enrolled students and concurrent attempt limit',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,14);
  const people=await Promise.all([
    prisma.user.create({data:{email:'practice-owner-'+nonce+'@example.invalid',name:'Owner'}}),
    prisma.user.create({data:{email:'practice-ownerb-'+nonce+'@example.invalid',name:'Other Owner'}}),
    prisma.user.create({data:{email:'practice-teacher-'+nonce+'@example.invalid',name:'Teacher'}}),
    prisma.user.create({data:{email:'practice-otherteacher-'+nonce+'@example.invalid',name:'Other Teacher'}}),
    prisma.user.create({data:{email:'practice-student-'+nonce+'@example.invalid',name:'Student'}}),
    prisma.user.create({data:{email:'practice-outsider-'+nonce+'@example.invalid',name:'Outsider'}}),
  ]);
  const [owner,ownerB,teacher,otherTeacher,student,unregistered]=people;
  const workspaceIds:string[]=[];
  try{
    const a=await prisma.workspace.create({
      data:{slug:'practice-a-'+nonce,name:'Practices Academy',type:'ACADEMY',
        members:{create:[
          {userId:owner!.id,role:'OWNER'},
          {userId:teacher!.id,role:'TEACHER'},
          {userId:otherTeacher!.id,role:'TEACHER'},
          {userId:student!.id,role:'STUDENT'},
          {userId:unregistered!.id,role:'STUDENT'},
        ]},
      },
    });
    workspaceIds.push(a.id);
    const b=await prisma.workspace.create({
      data:{slug:'practice-b-'+nonce,name:'Other Academy',type:'ACADEMY',
        members:{create:{userId:ownerB!.id,role:'OWNER'}}},
    });
    workspaceIds.push(b.id);
    const profile=await prisma.teacherProfile.create({
      data:{workspaceId:a.id,userId:teacher!.id},
    });
    const course=await prisma.course.create({data:{workspaceId:a.id,title:'Álgebra básica'}});
    await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
    const startsAt=new Date(Date.now()+3*86400000);
    const session=await prisma.classSession.create({
      data:{
        workspaceId:a.id,courseId:course.id,teacherProfileId:profile.id,title:'Repaso de ecuaciones',
        mode:'ONLINE',status:'CONFIRMED',startsAt,endsAt:new Date(startsAt.getTime()+3600000),
        timezone:'America/Bogota',meetingUrl:'https://meet.example.invalid/test',
      },
    });
    await prisma.classReflection.create({
      data:{sessionId:session.id,notes:'Repasamos ecuaciones y operaciones aritméticas con ejemplos.',status:'PUBLISHED',approvedAt:new Date()},
    });
    const api=new PracticeController(
      new PracticeUseCases(new PrismaPracticeRepository(),new PrismaMembershipAdapter()),
    );
    const draftInput={sessionId:session.id,title:'Evaluación de ecuaciones',questions:qs};
    await assert.rejects(()=>api.create(req(student!),a.id,draftInput),ForbiddenException);
    await assert.rejects(()=>api.create(req(ownerB!),b.id,draftInput),NotFoundException);
    await assert.rejects(()=>api.create(req(otherTeacher!),a.id,draftInput),ForbiddenException);
    const created=await api.create(req(teacher!),a.id,draftInput);
    assert.equal(created.publishedAt,null);
    assert.equal((await api.teacher(req(otherTeacher!),a.id)).length,0);
    assert.equal((await api.teacher(req(owner!),a.id)).length,1);
    assert.equal((await api.student(req(student!),a.id)).length,0);
    await assert.rejects(()=>api.submit(req(student!),a.id,created.id,{answers:[2,2]}),NotFoundException);
    await assert.rejects(()=>api.publish(req(ownerB!),b.id,created.id),NotFoundException);
    await assert.rejects(()=>api.publish(req(otherTeacher!),a.id,created.id),ForbiddenException);
    const revised=await api.revise(req(teacher!),a.id,created.id,{
      title:'Evaluación revisada',questions:qs,
    });
    assert.equal(revised.title,'Evaluación revisada');
    assert.ok((await api.publish(req(owner!),a.id,created.id)).publishedAt);
    const publicList=await api.student(req(student!),a.id);
    assert.equal(publicList.length,1);
    assert.equal(publicList[0]?.title,'Evaluación revisada');
    assert.equal(JSON.stringify(publicList).includes('correctIndex'),false);
    assert.equal(JSON.stringify(publicList).includes('explanation'),false);
    assert.equal((await api.student(req(unregistered!),a.id)).length,0);
    await assert.rejects(()=>api.submit(req(unregistered!),a.id,created.id,{answers:[2,2]}),NotFoundException);
    await assert.rejects(()=>api.revise(req(owner!),a.id,created.id,{
      title:'Intento de sobrescritura',questions:qs,
    }),ConflictException);
    await assert.rejects(()=>api.submit(req(student!),a.id,created.id,{answers:[1]}),BadRequestException);
    const attempts=await Promise.allSettled(Array.from({length:4},()=>api.submit(
      req(student!),a.id,created.id,{answers:[2,2]},
    )));
    assert.equal(attempts.filter(a=>a.status==='fulfilled').length,3);
    assert.equal(attempts.filter(a=>a.status==='rejected').length,1);
    assert.ok(attempts.some(a=>a.status==='rejected'&&a.reason instanceof ConflictException));
    const successes=attempts.filter(a=>a.status==='fulfilled');
    assert.deepEqual(successes.map(a=>a.value.attemptNumber).sort(),[1,2,3]);
    assert.equal(await prisma.activityAttempt.count({where:{
      activityId:created.id,userId:student!.id,
    }}),3);
    const passport=await api.passport(req(student!),a.id);
    assert.equal(passport.length,1);
    assert.equal(passport[0]?.attempts,3);
    assert.equal(passport[0]?.averageScore,100);
    assert.equal((await api.passport(req(unregistered!),a.id)).length,0);
    assert.equal((await api.teacher(req(ownerB!),b.id)).length,0);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
    await prisma.user.deleteMany({where:{id:{in:people.map(p=>p.id)}}});
    await prisma.$disconnect();
  }
});
