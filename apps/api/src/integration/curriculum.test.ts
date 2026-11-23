import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {PrismaCurriculumRepository} from '../modules/academics/infrastructure/prisma-curriculum-repository.js';
import {CurriculumUseCases} from '../modules/academics/application/curriculum-use-cases.js';
import {CurriculumController} from '../modules/academics/presentation/curriculum.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string}):AuthenticatedRequest{
  return {academyUser:{id:user.id,email:user.email,name:'Test'}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL curriculum: only assigned teachers can read and change their course',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,14);
  const people=await Promise.all([
    prisma.user.create({data:{email:'curriculum-owner-'+nonce+'@example.invalid',name:'Owner'}}),
    prisma.user.create({data:{email:'curriculum-teachera-'+nonce+'@example.invalid',name:'Teacher A'}}),
    prisma.user.create({data:{email:'curriculum-teacherb-'+nonce+'@example.invalid',name:'Teacher B'}}),
    prisma.user.create({data:{email:'curriculum-foreign-'+nonce+'@example.invalid',name:'Foreign Owner'}}),
  ]);
  const [owner,teacherA,teacherB,foreignOwner]=people;
  const workspaceIds:string[]=[];
  try{
    const a=await prisma.workspace.create({
      data:{slug:'curriculum-a-'+nonce,name:'Curriculum A',type:'ACADEMY',
        members:{create:[
          {userId:owner!.id,role:'OWNER'},
          {userId:teacherA!.id,role:'TEACHER'},
          {userId:teacherB!.id,role:'TEACHER'},
        ]},
      },
    });
    workspaceIds.push(a.id);
    const b=await prisma.workspace.create({
      data:{slug:'curriculum-b-'+nonce,name:'Curriculum B',type:'ACADEMY',
        members:{create:{userId:foreignOwner!.id,role:'OWNER'}},
      },
    });
    workspaceIds.push(b.id);
    const [profileA,profileB,foreignProfile,courseA,courseB]=await Promise.all([
      prisma.teacherProfile.create({data:{workspaceId:a.id,userId:teacherA!.id}}),
      prisma.teacherProfile.create({data:{workspaceId:a.id,userId:teacherB!.id}}),
      prisma.teacherProfile.create({data:{workspaceId:b.id,userId:foreignOwner!.id}}),
      prisma.course.create({data:{workspaceId:a.id,title:'Matemáticas'}}),
      prisma.course.create({data:{workspaceId:b.id,title:'Curso B'}}),
    ]);
    const api=new CurriculumController(
      new CurriculumUseCases(new PrismaCurriculumRepository(),new PrismaMembershipAdapter()),
    );
    await assert.rejects(()=>api.show(req(teacherA!),a.id,courseA.id),ForbiddenException);
    assert.equal((await api.show(req(owner!),a.id,courseA.id)).topics.length,0);
    await assert.rejects(()=>api.show(req(owner!),a.id,courseB.id),NotFoundException);
    await assert.rejects(()=>api.assign(req(owner!),a.id,courseA.id,{
      teacherId:foreignProfile.id,
    }),BadRequestException);
    await assert.rejects(()=>api.assign(req(teacherA!),a.id,courseA.id,{
      teacherId:profileB.id,
    }),ForbiddenException);

    await api.assign(req(owner!),a.id,courseA.id,{teacherId:profileA.id});
    await assert.rejects(()=>api.show(req(teacherB!),a.id,courseA.id),ForbiddenException);
    assert.equal((await api.show(req(teacherA!),a.id,courseA.id)).teachers.length,1);
    const topic=await api.createTopic(req(teacherA!),a.id,courseA.id,{
      title:'Ecuaciones lineales',order:1,
    });
    const child=await api.createTopic(req(owner!),a.id,courseA.id,{
      title:'Despeje de variables',parentId:topic.id,order:2,
    });
    assert.equal(child.parentId,topic.id);

    const parentB=await prisma.topic.create({
      data:{courseId:courseB.id,title:'Tema extranjero'},
    });
    await assert.rejects(()=>api.createTopic(req(owner!),a.id,courseA.id,{
      title:'Intento de cruce',parentId:parentB.id,
    }),BadRequestException);
    await assert.rejects(()=>api.createTopic(req(teacherB!),a.id,courseA.id,{
      title:'Sin asignación',
    }),ForbiddenException);
    assert.equal((await api.show(req(owner!),a.id,courseA.id)).topics.length,2);
    assert.equal((await api.show(req(foreignOwner!),b.id,courseB.id)).topics.length,1);
    await api.unassign(req(owner!),a.id,courseA.id,profileA.id);
    await assert.rejects(()=>api.show(req(teacherA!),a.id,courseA.id),ForbiddenException);
    await assert.rejects(()=>api.createTopic(req(teacherA!),a.id,courseA.id,{
      title:'Ya no puede editar',
    }),ForbiddenException);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
    await prisma.user.deleteMany({where:{id:{in:people.map(p=>p.id)}}});
    await prisma.$disconnect();
  }
});
