import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {GuardianUseCases} from '../modules/tenancy/application/guardian-use-cases.js';
import {PrismaGuardianRepository} from '../modules/tenancy/infrastructure/prisma-guardian-repository.js';
import {GuardiansController} from '../modules/tenancy/presentation/guardians.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string;name:string}):AuthenticatedRequest{
  return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL guardian portal denies unverified links, isolates academy and records revocations',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,13);
  const people=await Promise.all([
    prisma.user.create({data:{email:'guardian-owner-'+nonce+'@example.invalid',name:'Academy owner'}}),
    prisma.user.create({data:{email:'guardian-parent-'+nonce+'@example.invalid',name:'Guardian'}}),
    prisma.user.create({data:{email:'guardian-student-'+nonce+'@example.invalid',name:'Student'}}),
    prisma.user.create({data:{email:'guardian-other-'+nonce+'@example.invalid',name:'Other teacher'}}),
    prisma.user.create({data:{email:'guardian-foreign-'+nonce+'@example.invalid',name:'Foreign owner'}}),
  ]);
  const [owner,guardian,student,teacher,foreign]=people;
  const workspaces:string[]=[];
  try{
    const a=await prisma.workspace.create({data:{
      slug:'guardian-a-'+nonce,name:'Guardian Academy',type:'ACADEMY',
      members:{create:[
        {userId:owner!.id,role:'OWNER'},
        {userId:guardian!.id,role:'GUARDIAN'},
        {userId:student!.id,role:'STUDENT'},
        {userId:teacher!.id,role:'TEACHER'},
      ]},
    }});
    workspaces.push(a.id);
    const b=await prisma.workspace.create({data:{
      slug:'guardian-b-'+nonce,name:'Unrelated Academy',type:'ACADEMY',
      members:{create:[{userId:foreign!.id,role:'OWNER'},{userId:guardian!.id,role:'GUARDIAN'}]},
    }});
    workspaces.push(b.id);
    const [course,foreignCourse]=await Promise.all([
      prisma.course.create({data:{workspaceId:a.id,title:'Lenguaje'}}),
      prisma.course.create({data:{workspaceId:b.id,title:'Curso secreto de otra academia'}}),
    ]);
    await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
    const topic=await prisma.topic.create({data:{courseId:course.id,title:'Comprensión lectora'}});
    await prisma.skillProgress.create({data:{
      topicId:topic.id,userId:student!.id,mastery:75,evidenceCount:2,
    }});
    await prisma.learningGoal.create({data:{
      workspaceId:a.id,courseId:course.id,studentUserId:student!.id,
      assignedByUserId:owner!.id,title:'Leer textos de forma independiente',
      targetMastery:85,
    }});
    const api=new GuardiansController(
      new GuardianUseCases(new PrismaGuardianRepository(),new PrismaMembershipAdapter()),
    );
    assert.deepEqual(await api.students(req(guardian!),a.id),[]);
    await assert.rejects(()=>api.overview(req(guardian!),a.id,student!.id),NotFoundException);
    await assert.rejects(()=>api.start(req(guardian!),a.id,{
      guardianUserId:guardian!.id,studentUserId:student!.id,
    }),ForbiddenException);
    await assert.rejects(()=>api.start(req(teacher!),a.id,{
      guardianUserId:guardian!.id,studentUserId:student!.id,
    }),ForbiddenException);
    const pending=await api.start(req(owner!),a.id,{
      guardianUserId:guardian!.id,studentUserId:student!.id,
    });
    assert.equal(pending.status,'PENDING');
    assert.equal((await api.links(req(owner!),a.id)).length,1);
    await assert.rejects(()=>api.links(req(guardian!),a.id),ForbiddenException);
    await assert.rejects(()=>api.overview(req(guardian!),a.id,student!.id),NotFoundException);
    await assert.rejects(()=>api.approve(req(guardian!),a.id,pending.id,{
      verificationConfirmed:true,method:'IN_PERSON',
      verificationNote:'Comprobación realizada con autorización familiar',
    }),ForbiddenException);
    await assert.rejects(()=>api.approve(req(owner!),a.id,pending.id,{
      verificationConfirmed:false,method:'IN_PERSON',
      verificationNote:'Comprobación realizada con autorización familiar',
    }),BadRequestException);
    const approved=await api.approve(req(owner!),a.id,pending.id,{
      verificationConfirmed:true,method:'IN_PERSON',
      verificationNote:'La administración verificó el vínculo familiar',
    });
    assert.equal(approved.status,'ACTIVE');
    assert.equal((await api.students(req(guardian!),a.id)).length,1);
    const overview=await api.overview(req(guardian!),a.id,student!.id);
    assert.equal(overview.student.name,'Student');
    assert.equal(overview.courses.length,1);
    assert.equal(overview.courses[0]?.skills[0]?.mastery,75);
    assert.equal(overview.courses[0]?.goals[0]?.targetMastery,85);
    const serialized=JSON.stringify(overview);
    assert.ok(!serialized.includes('Curso secreto de otra academia'));
    assert.ok(!serialized.includes('meetingUrl'));
    assert.ok(!serialized.includes('email'));
    assert.ok(!serialized.includes('notes'));
    assert.ok(!serialized.includes(foreignCourse.id));
    await assert.rejects(()=>api.overview(req(guardian!),b.id,student!.id),NotFoundException);
    await assert.rejects(()=>api.overview(req(teacher!),a.id,student!.id),ForbiddenException);

    const revoked=await api.revoke(req(student!),a.id,pending.id,{
      reason:'El estudiante solicitó retirar el acceso del acudiente',
    });
    assert.equal(revoked.status,'REVOKED');
    await assert.rejects(()=>api.overview(req(guardian!),a.id,student!.id),NotFoundException);
    assert.equal((await api.students(req(guardian!),a.id)).length,0);
    assert.equal((await api.revoke(req(student!),a.id,pending.id,{
      reason:'Solicitud repetida de retiro de acceso',
    })).status,'REVOKED');
    assert.equal(await prisma.guardianLinkEvent.count({where:{linkId:pending.id}}),3);
    const renewed=await api.start(req(owner!),a.id,{
      guardianUserId:guardian!.id,studentUserId:student!.id,
    });
    assert.equal(renewed.id,pending.id);
    assert.equal(renewed.status,'PENDING');
    await assert.rejects(()=>api.overview(req(guardian!),a.id,student!.id),NotFoundException);
    assert.equal(await prisma.guardianLink.count({where:{workspaceId:a.id}}),1);
    assert.equal(await prisma.guardianLink.count({where:{workspaceId:b.id}}),0);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaces}}});
    await prisma.user.deleteMany({where:{id:{in:people.map(u=>u.id)}}});
    await prisma.$disconnect();
  }
});
