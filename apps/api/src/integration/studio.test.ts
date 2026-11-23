import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {StudioUseCases} from '../modules/commerce/application/studio-use-cases.js';
import {PrismaStudioRepository} from '../modules/commerce/infrastructure/prisma-studio-repository.js';
import {StudioController} from '../modules/commerce/presentation/studio.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(person:{id:string;email:string}):AuthenticatedRequest{
  return {academyUser:{id:person.id,email:person.email,name:'Test'}} as unknown as AuthenticatedRequest;
}
const offering={title:'Tutoría de matemáticas',description:'Clases personalizadas de álgebra',
  priceCOP:45000,durationMinutes:60,mode:'ONLINE' as const};
test('PostgreSQL Studio: private drafts, tenant-scoped offerings and opt-in public catalog',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,14);
  const users=await Promise.all([
    prisma.user.create({data:{email:'studio-owner-'+nonce+'@example.invalid',name:'Owner A'}}),
    prisma.user.create({data:{email:'studio-admin-'+nonce+'@example.invalid',name:'Admin A'}}),
    prisma.user.create({data:{email:'studio-student-'+nonce+'@example.invalid',name:'Student'}}),
    prisma.user.create({data:{email:'studio-foreign-'+nonce+'@example.invalid',name:'Foreign owner'}}),
  ]);
  const [owner,admin,student,foreign]=users;
  const ids:string[]=[];
  try{
    const a=await prisma.workspace.create({
      data:{slug:'studio-a-'+nonce,name:'Academy A',type:'ACADEMY',
        members:{create:[
          {userId:owner!.id,role:'OWNER'},
          {userId:admin!.id,role:'ADMIN'},
          {userId:student!.id,role:'STUDENT'},
        ]},
      },
    });
    ids.push(a.id);
    const b=await prisma.workspace.create({
      data:{slug:'studio-b-'+nonce,name:'Academy B',type:'ACADEMY',
        members:{create:{userId:foreign!.id,role:'OWNER'}}},
    });
    ids.push(b.id);
    const [courseA,courseB]=await Promise.all([
      prisma.course.create({data:{workspaceId:a.id,title:'Curso local'}}),
      prisma.course.create({data:{workspaceId:b.id,title:'Curso privado ajeno'}}),
    ]);
    const studio=new StudioController(
      new StudioUseCases(new PrismaStudioRepository(),new PrismaMembershipAdapter()),
    );
    await assert.rejects(()=>studio.publicStore(a.slug),NotFoundException);
    await assert.rejects(()=>studio.config(req(student!),a.id),ForbiddenException);
    await assert.rejects(()=>studio.update(req(foreign!),a.id,{publicEnabled:true}),ForbiddenException);
    await assert.rejects(()=>studio.update(req(owner!),a.id,{
      brandColor:'url(javascript:alert(1))',
    }),BadRequestException);
    await assert.rejects(()=>studio.update(req(owner!),a.id,{
      logoUrl:'http://insecure.invalid/logo.png',
    }),BadRequestException);
    await assert.rejects(()=>studio.create(req(owner!),a.id,{
      ...offering,courseId:courseB.id,
    }),BadRequestException);

    const created=await studio.create(req(admin!),a.id,{
      ...offering,courseId:courseA.id,
    });
    assert.equal(created.published,false);
    assert.equal((await studio.offerings(req(owner!),a.id)).length,1);
    assert.equal((await studio.offerings(req(foreign!),b.id)).length,0);

    const settings=await studio.update(req(owner!),a.id,{
      description:'Profesores que enseñan matemáticas',
      contactUrl:'https://wa.me/573001234567',
      brandColor:'#0088AA',logoUrl:'https://brand.example.invalid/academy.png',
      publicEnabled:true,
    });
    assert.equal(settings.publicEnabled,true);
    assert.equal(settings.brandColor,'#0088aa');
    assert.equal(settings.logoUrl,'https://brand.example.invalid/academy.png');
    const before=await studio.publicStore(a.slug);
    assert.equal(before.offerings.length,0);
    assert.equal(before.brandColor,'#0088aa');
    assert.equal(before.logoUrl,'https://brand.example.invalid/academy.png');
    assert.equal(JSON.stringify(before).includes(courseB.title),false);
    const changed=await studio.update(req(admin!),a.id,{description:'Academia de matemáticas'});
    assert.equal(changed.contactUrl,'https://wa.me/573001234567');

    await assert.rejects(()=>studio.setVisibility(req(foreign!),b.id,created.id,{
      published:true,
    }),NotFoundException);
    await assert.rejects(()=>studio.setVisibility(req(student!),a.id,created.id,{
      published:true,
    }),ForbiddenException);
    assert.deepEqual(await studio.setVisibility(req(owner!),a.id,created.id,{
      published:true,
    }),{id:created.id,published:true});
    const visible=await studio.publicStore(a.slug);
    assert.equal(visible.offerings.length,1);
    assert.equal(visible.offerings[0]?.title,offering.title);
    assert.equal(visible.offerings[0]?.course?.title,courseA.title);
    assert.equal('id'in visible,false);

    // Even malformed legacy relations must never leak a foreign course title.
    await prisma.offering.create({
      data:{
        workspaceId:a.id,courseId:courseB.id,title:'Relación cruzada inválida',
        description:'Debe quedar fuera del catálogo',priceCOP:70000,
        durationMinutes:60,mode:'ONLINE',published:true,
      },
    });
    assert.equal((await studio.publicStore(a.slug)).offerings.length,1);
    await studio.setVisibility(req(admin!),a.id,created.id,{published:false});
    assert.equal((await studio.publicStore(a.slug)).offerings.length,0);
    await studio.update(req(owner!),a.id,{publicEnabled:false});
    await assert.rejects(()=>studio.publicStore(a.slug),NotFoundException);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:ids}}});
    await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
    await prisma.$disconnect();
  }
});
