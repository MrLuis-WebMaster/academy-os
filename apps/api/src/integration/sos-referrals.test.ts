import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {SosReferralUseCases} from '../modules/learning/application/sos-referral-use-cases.js';
import {PrismaSosReferralRepository} from '../modules/learning/infrastructure/prisma-sos-referral-repository.js';
import {SosReferralsController} from '../modules/learning/presentation/sos-referrals.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string;name:string}):AuthenticatedRequest{
 return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
test('SOS referrals isolate private student questions and notify only authorized teachers',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,13);
 const people=await Promise.all([
  prisma.user.create({data:{email:'sos-owner-'+nonce+'@example.invalid',name:'Owner'}}),
  prisma.user.create({data:{email:'sos-teacher-'+nonce+'@example.invalid',name:'Teacher'}}),
  prisma.user.create({data:{email:'sos-otherteacher-'+nonce+'@example.invalid',name:'Another teacher'}}),
  prisma.user.create({data:{email:'sos-student-'+nonce+'@example.invalid',name:'Student'}}),
  prisma.user.create({data:{email:'sos-otherstudent-'+nonce+'@example.invalid',name:'Other student'}}),
  prisma.user.create({data:{email:'sos-foreign-'+nonce+'@example.invalid',name:'Foreign owner'}}),
 ]);
 const [owner,teacher,otherTeacher,student,otherStudent,foreign]=people;
 const workspaceIds:string[]=[];
 try{
  const school=await prisma.workspace.create({data:{
   slug:'sos-a-'+nonce,name:'SOS Academy',type:'ACADEMY',
   members:{create:[
    {userId:owner!.id,role:'OWNER'},
    {userId:teacher!.id,role:'TEACHER'},
    {userId:otherTeacher!.id,role:'TEACHER'},
    {userId:student!.id,role:'STUDENT'},
    {userId:otherStudent!.id,role:'STUDENT'},
   ]},
  }});
  workspaceIds.push(school.id);
  const other=await prisma.workspace.create({data:{
   slug:'sos-b-'+nonce,name:'Other Academy',type:'SOLO',
   members:{create:{userId:foreign!.id,role:'OWNER'}},
  }});
  workspaceIds.push(other.id);
  const [t1,t2]=await Promise.all([
   prisma.teacherProfile.create({data:{workspaceId:school.id,userId:teacher!.id}}),
   prisma.teacherProfile.create({data:{workspaceId:school.id,userId:otherTeacher!.id}}),
  ]);
  const course=await prisma.course.create({data:{workspaceId:school.id,title:'Ecuaciones'}}); 
  await prisma.courseTeacher.create({data:{courseId:course.id,teacherId:t1.id}});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
  const api=new SosReferralsController(
   new SosReferralUseCases(new PrismaSosReferralRepository(),new PrismaMembershipAdapter()),
  );
  const question='¿Cómo se resuelve una ecuación de segundo grado?';
  await assert.rejects(()=>api.send(req(otherStudent!),school.id,{courseId:course.id,question}),ForbiddenException);
  await assert.rejects(()=>api.send(req(foreign!),other.id,{courseId:course.id,question}),ForbiddenException);
  assert.equal((await api.mine(req(student!),school.id)).length,0);
  const first=await api.send(req(student!),school.id,{courseId:course.id,question});
  assert.equal(first.status,'OPEN');
  assert.equal((await api.mine(req(student!),school.id)).length,1);
  assert.equal((await api.mine(req(otherStudent!),school.id)).length,0);
  assert.equal((await api.staff(req(teacher!),school.id)).length,1);
  assert.equal((await api.staff(req(otherTeacher!),school.id)).length,0);
  assert.equal((await api.staff(req(owner!),school.id)).length,1);
  assert.equal((await api.staff(req(foreign!),other.id)).length,0);
  assert.equal(await prisma.notification.count({where:{
   workspaceId:school.id,userId:teacher!.id,kind:'SOS_REQUEST',
  }}),1);
  assert.equal(await prisma.notification.count({where:{
   workspaceId:school.id,userId:otherTeacher!.id,kind:'SOS_REQUEST',
  }}),0);
  await assert.rejects(()=>api.resolve(req(otherTeacher!),school.id,first.id,{
   reply:'Repasemos juntos primero qué representa el coeficiente principal.',
  }),ForbiddenException);
  await assert.rejects(()=>api.resolve(req(foreign!),other.id,first.id,{
   reply:'Esta academia no debería responder la pregunta.',
  }),NotFoundException);
  const answered=await api.resolve(req(teacher!),school.id,first.id,{
   reply:'Primero identifica los coeficientes a, b y c, luego revisamos la fórmula.',
  });
  assert.equal(answered.status,'RESOLVED');
  assert.equal((await api.mine(req(student!),school.id))[0]?.status,'RESOLVED');
  assert.equal(await prisma.notification.count({where:{
   workspaceId:school.id,userId:student!.id,kind:'SOS_ANSWERED',
  }}),1);
  const repeated=await api.resolve(req(teacher!),school.id,first.id,{
   reply:'Esta solicitud repetida no debe sobrescribir la respuesta.',
  });
  assert.equal(repeated.reply,answered.reply);
  assert.equal(await prisma.notification.count({where:{
   workspaceId:school.id,userId:student!.id,kind:'SOS_ANSWERED',
  }}),1);
  const openQuestion='Me perdí en el segundo paso, ¿me ayudas con otra pista?';
  for(let i=0;i<3;i++){
   await api.send(req(student!),school.id,{courseId:course.id,question:openQuestion+' '+i});
  }
  await assert.rejects(()=>api.send(req(student!),school.id,{
   courseId:course.id,question:'¿Me ayudas con un cuarto problema?',
  }),ConflictException);
  assert.equal(await prisma.sosReferral.count({where:{
   workspaceId:school.id,courseId:course.id,studentUserId:student!.id,
  }}),4);
  await prisma.courseTeacher.delete({where:{courseId_teacherId:{courseId:course.id,teacherId:t1.id}}});
  await prisma.courseTeacher.create({data:{courseId:course.id,teacherId:t2.id}});
  await assert.rejects(()=>api.resolve(req(teacher!),school.id,first.id,{
   reply:'Ya no está asignado al curso.',
  }),ForbiddenException);
  assert.equal((await api.staff(req(teacher!),school.id)).length,0);
  assert.equal((await api.staff(req(otherTeacher!),school.id)).length,4);
  await prisma.enrollment.delete({where:{courseId_userId:{courseId:course.id,userId:student!.id}}});
  assert.equal((await api.mine(req(student!),school.id)).length,0);
  assert.equal(await prisma.sosReferral.count({where:{workspaceId:other.id}}),0);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
  await prisma.user.deleteMany({where:{id:{in:people.map(u=>u.id)}}});
  await prisma.$disconnect();
 }
});
