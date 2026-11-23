import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {VenueUseCases} from '../modules/scheduling/application/venue-use-cases.js';
import {PrismaVenueRepository} from '../modules/scheduling/infrastructure/prisma-venue-repository.js';
import {VenuesController} from '../modules/scheduling/presentation/venues.controller.js';
import {LessonUseCases} from '../modules/scheduling/application/lesson-use-cases.js';
import {PrismaLessonRepository} from '../modules/scheduling/infrastructure/prisma-lesson-repository.js';
import {LessonsController} from '../modules/scheduling/presentation/lessons.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';
function req(person:{id:string;email:string}):AuthenticatedRequest {
 return {academyUser:{id:person.id,email:person.email,name:person.name}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL: rooms have tenant scope, capacity and exclusive confirmed schedules',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,14);
 const people=await Promise.all([
  prisma.user.create({data:{email:'room-owner-'+nonce+'@example.invalid',name:'Owner'}}),
  prisma.user.create({data:{email:'room-teacher1-'+nonce+'@example.invalid',name:'Teacher One'}}),
  prisma.user.create({data:{email:'room-teacher2-'+nonce+'@example.invalid',name:'Teacher Two'}}),
  prisma.user.create({data:{email:'room-foreign-'+nonce+'@example.invalid',name:'Foreign Owner'}}),
 ]);
 const [owner,teacherOne,teacherTwo,foreignOwner]=people;
 const workspaces:string[]=[];
 try{
  const a=await prisma.workspace.create({data:{
   slug:'rooms-a-'+nonce,name:'Academy A',type:'ACADEMY',
   members:{create:[
    {userId:owner!.id,role:'OWNER'},
    {userId:teacherOne!.id,role:'TEACHER'},
    {userId:teacherTwo!.id,role:'TEACHER'},
   ]},
  }});
  workspaces.push(a.id);
  const b=await prisma.workspace.create({data:{
   slug:'rooms-b-'+nonce,name:'Academy B',type:'ACADEMY',
   members:{create:{userId:foreignOwner!.id,role:'OWNER'}},
  }});
  workspaces.push(b.id);
  const [profileOne,profileTwo]=await Promise.all([
   prisma.teacherProfile.create({data:{workspaceId:a.id,userId:teacherOne!.id}}),
   prisma.teacherProfile.create({data:{workspaceId:a.id,userId:teacherTwo!.id}}),
  ]);
  const venues=new VenuesController(
   new VenueUseCases(new PrismaVenueRepository(),new PrismaMembershipAdapter()),
  );
  const lessons=new LessonsController(
   new LessonUseCases(new PrismaLessonRepository(),new PrismaMembershipAdapter()),
  );
  await assert.rejects(()=>venues.createCampus(req(foreignOwner!),a.id,{
   name:'Sede Principal',address:'Carrera 20 #10-50',
  }),ForbiddenException);
  const campus=await venues.createCampus(req(owner!),a.id,{
   name:'Sede Principal',address:'Carrera 20 #10-50',
  });
  const room=await venues.createRoom(req(owner!),a.id,campus.id,{
   name:'Aula 101',capacity:2,
  });
  assert.equal((await venues.list(req(teacherOne!),a.id))[0]?.rooms.length,1);
  assert.equal((await venues.list(req(foreignOwner!),b.id)).length,0);
  const foreignCampus=await venues.createCampus(req(foreignOwner!),b.id,{
   name:'Sede Externa',address:'Calle 15 #90-10',
  });
  const foreignRoom=await venues.createRoom(req(foreignOwner!),b.id,foreignCampus.id,{
   name:'Aula Externa',capacity:10,
  });
  const start=new Date(Date.now()+11*86400000);
  start.setUTCHours(15,0,0,0);
  const input={
   title:'Clase física',mode:'ONSITE',startsAt:start.toISOString(),
   endsAt:new Date(start.getTime()+3600000).toISOString(),
   location:'Sede Principal Aula 101',capacity:2,roomId:room.id,
  };
  await assert.rejects(()=>lessons.create(req(owner!),a.id,{
   ...input,teacherProfileId:profileOne.id,roomId:foreignRoom.id,
  }),BadRequestException);
  await assert.rejects(()=>lessons.create(req(owner!),a.id,{
   ...input,teacherProfileId:profileOne.id,capacity:3,
  }),ConflictException);
  const first=await lessons.create(req(teacherOne!),a.id,{
   ...input,teacherProfileId:profileOne.id,
  });
  assert.equal(first.status,'CONFIRMED');
  await assert.rejects(()=>lessons.create(req(teacherTwo!),a.id,{
   ...input,teacherProfileId:profileTwo.id,
  }),ConflictException);
  await assert.rejects(()=>venues.changeRoom(req(owner!),a.id,room.id,{
   capacity:1,
  }),ConflictException);
  await assert.rejects(()=>venues.changeRoom(req(owner!),a.id,room.id,{
   active:false,
  }),ConflictException);
  await assert.rejects(()=>venues.changeCampus(req(owner!),a.id,campus.id,{
   active:false,
  }),ConflictException);
  await lessons.cancel(req(owner!),a.id,first.id);
  assert.equal((await venues.changeRoom(req(owner!),a.id,room.id,{capacity:1})).capacity,1);
  const second=await lessons.create(req(teacherTwo!),a.id,{
   ...input,teacherProfileId:profileTwo.id,capacity:1,
  });
  assert.equal(second.status,'CONFIRMED');
  await lessons.cancel(req(owner!),a.id,second.id);
  assert.equal((await venues.changeRoom(req(owner!),a.id,room.id,{active:false})).active,false);
  await assert.rejects(()=>lessons.create(req(owner!),a.id,{
   ...input,teacherProfileId:profileOne.id,capacity:1,
  }),BadRequestException);
  assert.equal((await venues.changeRoom(req(owner!),a.id,room.id,{active:true})).active,true);
  assert.equal((await venues.changeCampus(req(owner!),a.id,campus.id,{active:false})).active,false);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaces}}});
  await prisma.user.deleteMany({where:{id:{in:people.map(p=>p.id)}}});
  await prisma.$disconnect();
 }
});
