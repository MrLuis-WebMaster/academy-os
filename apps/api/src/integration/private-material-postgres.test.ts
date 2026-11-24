import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {PrismaPrivateMaterialRepository} from '../modules/classroom/infrastructure/prisma-private-material-repository.js';
import {PrismaStudentClassroomRead} from '../modules/classroom/infrastructure/prisma-student-classroom-read.js';
import {parsePrivateMaterial,PrivateMaterialMissing} from '../modules/classroom/domain/private-material.js';

test('PostgreSQL: file lifecycle respects course assignment, publication and tenant boundaries',async()=>{
 const nonce=randomUUID().slice(0,12);
 const users=await Promise.all(['owner','teacher','student','other'].map(name=>prisma.user.create({data:{name,email:'file-'+name+'-'+nonce+'@example.invalid'}})));
 const [owner,teacher,student,other]=users;
 assert.ok(owner&&teacher&&student&&other);
 const workspaces:string[]=[];
 try{
  const a=await prisma.workspace.create({data:{name:'Files A',slug:'files-a-'+nonce,type:'ACADEMY',members:{create:[
   {userId:owner.id,role:'OWNER'},{userId:teacher.id,role:'TEACHER'},{userId:student.id,role:'STUDENT'},{userId:other.id,role:'STUDENT'},
  ]}}});workspaces.push(a.id);
  const b=await prisma.workspace.create({data:{name:'Files B',slug:'files-b-'+nonce,type:'ACADEMY',members:{create:{userId:owner.id,role:'OWNER'}}}});workspaces.push(b.id);
  const course=await prisma.course.create({data:{workspaceId:a.id,title:'Assigned'}});
  const unassigned=await prisma.course.create({data:{workspaceId:a.id,title:'Unassigned'}});
  const profile=await prisma.teacherProfile.create({data:{workspaceId:a.id,userId:teacher.id}});
  await prisma.courseTeacher.create({data:{courseId:course.id,teacherId:profile.id}});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student.id}});
  const bytes=Buffer.from('%PDF-1.7\nFixture');
  const input=parsePrivateMaterial({courseId:course.id,title:'Guide'},{originalname:'guide.pdf',mimetype:'application/pdf',buffer:bytes});
  const repo=new PrismaPrivateMaterialRepository(),classroom=new PrismaStudentClassroomRead();
  await assert.rejects(()=>repo.create(a.id,teacher.id,{...input,courseId:unassigned.id}),PrivateMaterialMissing);
  await assert.rejects(()=>repo.create(b.id,owner.id,input),PrivateMaterialMissing);
  const file=await repo.create(a.id,teacher.id,input);
  assert.equal(file.published,false);
  assert.equal((await repo.list(a.id,teacher.id)).length,1);
  assert.deepEqual(Buffer.from((await repo.download(a.id,owner.id,file.id)).content),bytes);
  await assert.rejects(()=>repo.download(a.id,student.id,file.id),PrivateMaterialMissing);
  await repo.setPublished(a.id,teacher.id,file.id,true);
  assert.equal((await classroom.forStudent(a.id,student.id))[0]?.course.resources[0]?.id,file.id);
  assert.deepEqual(Buffer.from((await repo.download(a.id,student.id,file.id)).content),bytes);
  await assert.rejects(()=>repo.download(a.id,other.id,file.id),PrivateMaterialMissing);
  await assert.rejects(()=>repo.download(b.id,owner.id,file.id),PrivateMaterialMissing);
  await repo.setPublished(a.id,teacher.id,file.id,false);
  await assert.rejects(()=>repo.download(a.id,student.id,file.id),PrivateMaterialMissing);
  await repo.remove(a.id,owner.id,file.id);
  assert.equal(await prisma.privateMaterialFile.count({where:{resourceId:file.id}}),0);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaces}}});
  await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
  await prisma.$disconnect();
 }
});
