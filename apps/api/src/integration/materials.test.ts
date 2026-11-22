import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {CatalogController} from '../workspaces/catalog.controller.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {MaterialUseCases} from '../modules/classroom/application/material-use-cases.js';
import {PrismaMaterialRepository} from '../modules/classroom/infrastructure/prisma-material-repository.js';
import {MaterialsController} from '../modules/classroom/presentation/materials.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function request(id:string):AuthenticatedRequest {
  return {academyUser:{id,email:'test@example.invalid',name:'Test'}} as unknown as AuthenticatedRequest;
}

test('PostgreSQL: published materials respect academy, course and student enrollment',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,15);
  const [ownerA,ownerB,adminA,student]=await Promise.all([
    prisma.user.create({data:{email:'materials-owner-a-'+nonce+'@example.invalid',name:'Owner A'}}),
    prisma.user.create({data:{email:'materials-owner-b-'+nonce+'@example.invalid',name:'Owner B'}}),
    prisma.user.create({data:{email:'materials-admin-'+nonce+'@example.invalid',name:'Admin A'}}),
    prisma.user.create({data:{email:'materials-student-'+nonce+'@example.invalid',name:'Student A'}}),
  ]);
  const workspaceIds:string[]=[];
  try{
    const a=await prisma.workspace.create({
      data:{
        name:'Materials Academy A',slug:'materials-a-'+nonce,type:'ACADEMY',
        members:{create:[
          {userId:ownerA.id,role:'OWNER'},
          {userId:adminA.id,role:'ADMIN'},
          {userId:student.id,role:'STUDENT'},
        ]},
      },
    });
    workspaceIds.push(a.id);
    const b=await prisma.workspace.create({
      data:{
        name:'Materials Academy B',slug:'materials-b-'+nonce,type:'ACADEMY',
        members:{create:{userId:ownerB.id,role:'OWNER'}},
      },
    });
    workspaceIds.push(b.id);
    const [courseA,courseB,coursePrivate]=await Promise.all([
      prisma.course.create({data:{workspaceId:a.id,title:'Matemáticas'}}),
      prisma.course.create({data:{workspaceId:b.id,title:'Otro campus'}}),
      prisma.course.create({data:{workspaceId:a.id,title:'Curso sin matrícula'}}),
    ]);
    await prisma.enrollment.create({data:{courseId:courseA.id,userId:student.id}});
    const materials=new MaterialsController(
      new MaterialUseCases(new PrismaMaterialRepository(),new PrismaMembershipAdapter()),
    );
    const catalog=new CatalogController();
    const raw={courseId:courseA.id,title:'Guía segura',url:'https://example.com/guide'};
    await assert.rejects(()=>materials.list(request(student.id),a.id),ForbiddenException);
    await assert.rejects(()=>materials.create(request(student.id),a.id,raw),ForbiddenException);
    await assert.rejects(()=>materials.create(request(ownerA.id),a.id,{
      ...raw,courseId:courseB.id,
    }),BadRequestException);
    assert.equal(await prisma.resource.count({where:{workspaceId:a.id}}),0);

    const draft=await materials.create(request(adminA.id),a.id,raw);
    assert.equal(draft.published,false);
    assert.equal((await materials.list(request(ownerA.id),a.id)).length,1);
    const before=await catalog.classroom(request(student.id),a.id);
    assert.equal(before.length,1);
    assert.equal(before[0]?.course.resources.length,0);

    await assert.rejects(()=>materials.setPublished(request(ownerB.id),b.id,draft.id,{
      published:true,
    }),NotFoundException);
    await assert.rejects(()=>materials.setPublished(request(student.id),a.id,draft.id,{
      published:true,
    }),ForbiddenException);
    await assert.rejects(()=>materials.setPublished(request(ownerA.id),a.id,draft.id,{
      published:'true',
    }),BadRequestException);

    assert.deepEqual(await materials.setPublished(request(ownerA.id),a.id,draft.id,{
      published:true,
    }),{id:draft.id,published:true});
    const published=await catalog.classroom(request(student.id),a.id);
    assert.equal(published[0]?.course.resources.length,1);
    assert.equal(published[0]?.course.resources[0]?.id,draft.id);

    const privateResource=await materials.create(request(ownerA.id),a.id,{
      ...raw,title:'Documento para otro curso',courseId:coursePrivate.id,published:true,
    });
    assert.ok(privateResource.id);
    assert.equal((await catalog.classroom(request(student.id),a.id))[0]?.course.resources.length,1);
    await materials.setPublished(request(adminA.id),a.id,draft.id,{published:false});
    assert.equal((await catalog.classroom(request(student.id),a.id))[0]?.course.resources.length,0);

    const foreign=await materials.create(request(ownerB.id),b.id,{
      ...raw,title:'Documento B',courseId:courseB.id,published:true,
    });
    assert.equal((await catalog.classroom(request(student.id),a.id))[0]?.course.resources.length,0);
    assert.equal((await materials.list(request(ownerA.id),a.id)).some(item=>item.id===foreign.id),false);
    assert.equal((await prisma.resource.findUniqueOrThrow({
      where:{id:draft.id},select:{aiAuthorized:true},
    })).aiAuthorized,false);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
    await prisma.user.deleteMany({where:{id:{in:[ownerA.id,ownerB.id,adminA.id,student.id]}}});
    await prisma.$disconnect();
  }
});
