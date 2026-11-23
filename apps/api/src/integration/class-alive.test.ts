import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {PrismaReflectionRepository} from '../modules/learning/infrastructure/prisma-reflection-repository.js';
import {ReflectionUseCases} from '../modules/learning/application/reflection-use-cases.js';
import {ClassAliveController} from '../modules/learning/presentation/class-alive.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(id:string):AuthenticatedRequest {
  return {academyUser:{id,email:'test@example.invalid',name:'Test'}} as unknown as AuthenticatedRequest;
}
const notes={notes:'Hoy practicamos álgebra en grupos y revisamos ejercicios de la semana anterior.'};
test('PostgreSQL Class Alive: publishing is isolated and immutable across academies',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,14);
  const users=await Promise.all([
    prisma.user.create({data:{email:'reflection-owner-a-'+nonce+'@example.invalid',name:'Owner A'}}),
    prisma.user.create({data:{email:'reflection-owner-b-'+nonce+'@example.invalid',name:'Owner B'}}),
    prisma.user.create({data:{email:'reflection-teacher-a-'+nonce+'@example.invalid',name:'Teacher A'}}),
    prisma.user.create({data:{email:'reflection-teacher-b-'+nonce+'@example.invalid',name:'Teacher B'}}),
    prisma.user.create({data:{email:'reflection-student-'+nonce+'@example.invalid',name:'Student'}}),
    prisma.user.create({data:{email:'reflection-other-student-'+nonce+'@example.invalid',name:'Student Outside'}}),
  ]);
  const [ownerA,ownerB,teacherA,teacherB,student,otherStudent]=users;
  const workspaceIds:string[]=[];
  try{
    const a=await prisma.workspace.create({
      data:{slug:'reflection-a-'+nonce,name:'Reflections A',type:'ACADEMY',members:{create:[
        {userId:ownerA!.id,role:'OWNER'},
        {userId:teacherA!.id,role:'TEACHER'},
        {userId:teacherB!.id,role:'TEACHER'},
        {userId:student!.id,role:'STUDENT'},
        {userId:otherStudent!.id,role:'STUDENT'},
      ]}},
    });
    workspaceIds.push(a.id);
    const b=await prisma.workspace.create({
      data:{slug:'reflection-b-'+nonce,name:'Reflections B',type:'ACADEMY',
        members:{create:{userId:ownerB!.id,role:'OWNER'}}},
    });
    workspaceIds.push(b.id);
    const [profileA,profileB,course,foreignCourse]=await Promise.all([
      prisma.teacherProfile.create({data:{workspaceId:a.id,userId:teacherA!.id}}),
      prisma.teacherProfile.create({data:{workspaceId:a.id,userId:teacherB!.id}}),
      prisma.course.create({data:{workspaceId:a.id,title:'Álgebra'}}),
      prisma.course.create({data:{workspaceId:b.id,title:'Curso privado B'}}),
    ]);
    const start=new Date(Date.now()+2*86400000);
    const session=await prisma.classSession.create({
      data:{
        workspaceId:a.id,courseId:course.id,teacherProfileId:profileA.id,title:'Aula del profesor',
        mode:'ONLINE',startsAt:start,endsAt:new Date(start.getTime()+3600000),
        status:'CONFIRMED',timezone:'America/Bogota',meetingUrl:'https://meet.example.invalid/abc',
      },
    });
    const sessionB=await prisma.classSession.create({
      data:{
        workspaceId:b.id,courseId:foreignCourse.id,title:'Aula ajena',
        mode:'ONLINE',startsAt:start,endsAt:new Date(start.getTime()+3600000),
        status:'CONFIRMED',timezone:'America/Bogota',meetingUrl:'https://meet.example.invalid/other',
      },
    });
    await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
    const controller=new ClassAliveController(
      new ReflectionUseCases(new PrismaReflectionRepository(),new PrismaMembershipAdapter()),
    );
    assert.equal((await controller.published(req(student!.id),a.id)).length,0);
    await assert.rejects(()=>controller.save(req(student!.id),a.id,session.id,notes),ForbiddenException);
    await assert.rejects(()=>controller.save(req(teacherB!.id),a.id,session.id,notes),ForbiddenException);
    await assert.rejects(()=>controller.save(req(ownerB!.id),b.id,session.id,notes),NotFoundException);
    await assert.rejects(()=>controller.save(req(ownerA!.id),a.id,sessionB.id,notes),NotFoundException);
    assert.equal((await controller.list(req(teacherB!.id),a.id)).length,0);
    const saved=await controller.save(req(teacherA!.id),a.id,session.id,notes);
    assert.equal(saved.status,'DRAFT');
    assert.equal((await controller.published(req(student!.id),a.id)).length,0);
    await assert.rejects(()=>controller.publish(req(teacherB!.id),a.id,session.id),ForbiddenException);
    assert.equal((await controller.list(req(ownerA!.id),a.id)).length,1);
    const published=await controller.publish(req(ownerA!.id),a.id,session.id);
    assert.equal(published.status,'PUBLISHED');
    assert.ok(published.approvedAt);
    const myNotes=await controller.published(req(student!.id),a.id);
    assert.equal(myNotes.length,1);
    assert.equal(myNotes[0]?.session.id,session.id);
    assert.equal((await controller.published(req(otherStudent!.id),a.id)).length,0);
    await assert.rejects(()=>controller.save(req(ownerA!.id),a.id,session.id,{
      notes:'No debe sobrescribirse una nota ya publicada en esta academia.',
    }),ConflictException);
    await assert.rejects(()=>controller.publish(req(ownerA!.id),a.id,session.id),ConflictException);
    assert.equal((await prisma.classReflection.findUniqueOrThrow({
      where:{sessionId:session.id},select:{notes:true},
    })).notes,notes.notes);
    assert.equal((await controller.list(req(ownerB!.id),b.id)).length,0);
    void profileB;
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
    await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
    await prisma.$disconnect();
  }
});
