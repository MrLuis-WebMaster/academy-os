import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {StudentProgressUseCases} from '../modules/learning/application/student-progress-use-cases.js';
import {PrismaStudentProgressRepository} from '../modules/learning/infrastructure/prisma-student-progress-repository.js';
import {StudentProgressController} from '../modules/learning/presentation/student-progress.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string;name:string}):AuthenticatedRequest{
  return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL progress: human evidence, idempotence, mastery and restricted goals',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,12);
  const people=await Promise.all([
    prisma.user.create({data:{email:'skills-owner-'+nonce+'@example.invalid',name:'Owner'}}),
    prisma.user.create({data:{email:'skills-teacher-'+nonce+'@example.invalid',name:'Teacher'}}),
    prisma.user.create({data:{email:'skills-student-'+nonce+'@example.invalid',name:'Student'}}),
    prisma.user.create({data:{email:'skills-visitor-'+nonce+'@example.invalid',name:'Visitor'}}),
    prisma.user.create({data:{email:'skills-foreign-'+nonce+'@example.invalid',name:'Foreign Owner'}}),
  ]);
  const [owner,teacher,student,visitor,foreign]=people;
  const workspaceIds:string[]=[];
  try{
    const academy=await prisma.workspace.create({data:{
      slug:'skills-academy-'+nonce,name:'Skills Academy',type:'ACADEMY',
      members:{create:[
        {userId:owner!.id,role:'OWNER'},{userId:teacher!.id,role:'TEACHER'},
        {userId:student!.id,role:'STUDENT'},{userId:visitor!.id,role:'STUDENT'},
      ]},
    }});
    workspaceIds.push(academy.id);
    const outsider=await prisma.workspace.create({data:{
      slug:'skills-foreign-'+nonce,name:'Foreign Skills Academy',type:'ACADEMY',
      members:{create:{userId:foreign!.id,role:'OWNER'}},
    }});
    workspaceIds.push(outsider.id);
    const [profile,course,foreignCourse]=await Promise.all([
      prisma.teacherProfile.create({data:{workspaceId:academy.id,userId:teacher!.id}}),
      prisma.course.create({data:{workspaceId:academy.id,title:'Álgebra aplicada'}}),
      prisma.course.create({data:{workspaceId:outsider.id,title:'Curso ajeno'}}),
    ]);
    const [topic,foreignTopic]=await Promise.all([
      prisma.topic.create({data:{courseId:course.id,title:'Ecuaciones lineales',order:1}}),
      prisma.topic.create({data:{courseId:foreignCourse.id,title:'Competencia ajena'}}),
    ]);
    await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
    const api=new StudentProgressController(
      new StudentProgressUseCases(new PrismaStudentProgressRepository(),new PrismaMembershipAdapter()),
    );
    assert.deepEqual(await api.student(req(student!),academy.id),{skills:[],goals:[]});
    await assert.rejects(()=>api.student(req(teacher!),academy.id),ForbiddenException);
    await assert.rejects(()=>api.course(req(teacher!),academy.id,course.id),ForbiddenException);
    const firstInput={
      topicId:topic.id,studentUserId:student!.id,
      requestId:randomUUID(),score:80,note:'Resolvió problemas básicos sin ayuda directa.',
    };
    await assert.rejects(()=>api.evidence(req(student!),academy.id,firstInput),ForbiddenException);
    await assert.rejects(()=>api.evidence(req(teacher!),academy.id,firstInput),ForbiddenException);
    await assert.rejects(()=>api.evidence(req(owner!),academy.id,{
      ...firstInput,topicId:foreignTopic.id,
    }),NotFoundException);
    await assert.rejects(()=>api.evidence(req(owner!),academy.id,{
      ...firstInput,studentUserId:visitor!.id,
    }),NotFoundException);
    await prisma.courseTeacher.create({data:{courseId:course.id,teacherId:profile.id}});
    const first=await api.evidence(req(teacher!),academy.id,firstInput);
    assert.equal(first.mastery,80);
    assert.equal(first.evidenceCount,1);
    assert.equal((await api.evidence(req(teacher!),academy.id,firstInput)).id,first.id);
    await assert.rejects(()=>api.evidence(req(teacher!),academy.id,{
      ...firstInput,score:99,
    }),ConflictException);
    assert.equal(await prisma.skillEvidence.count({where:{
      workspaceId:academy.id,topicId:topic.id,studentUserId:student!.id,
    }}),1);
    const second=await api.evidence(req(owner!),academy.id,{
      ...firstInput,requestId:randomUUID(),score:100,
      note:'Demostró autonomía resolviendo ecuaciones complejas.',
    });
    assert.equal(second.mastery,90);
    assert.equal(second.evidenceCount,2);

    const parallel=await Promise.all([
      api.evidence(req(owner!),academy.id,{
        ...firstInput,requestId:randomUUID(),score:70,
        note:'Aplicó el método con cierta ayuda del profesor.',
      }),
      api.evidence(req(teacher!),academy.id,{
        ...firstInput,requestId:randomUUID(),score:90,
        note:'Comprobó resultados correctamente y explicó su proceso.',
      }),
    ]);
    assert.equal(parallel.length,2);
    const progress=await prisma.skillProgress.findUniqueOrThrow({
      where:{topicId_userId:{topicId:topic.id,userId:student!.id}},
    });
    assert.equal(progress.mastery,85);
    assert.equal(progress.evidenceCount,4);
    const studentView=await api.student(req(student!),academy.id);
    assert.equal(studentView.skills.length,1);
    assert.equal(studentView.skills[0]?.mastery,85);
    assert.equal((await api.student(req(visitor!),academy.id)).skills.length,0);
    assert.equal((await api.student(req(foreign!),outsider.id)).skills.length,0);
    assert.equal((await api.course(req(teacher!),academy.id,course.id)).students.length,1);
    assert.equal((await api.evidenceHistory(req(teacher!),academy.id,topic.id,student!.id)).length,4);
    await assert.rejects(()=>api.evidenceHistory(req(owner!),academy.id,foreignTopic.id,student!.id),NotFoundException);

    const goal=await api.createGoal(req(teacher!),academy.id,{
      courseId:course.id,topicId:topic.id,studentUserId:student!.id,
      title:'Resolver ecuaciones con autonomía',description:'Dominar ejercicios en tres sesiones',
      targetMastery:90,targetAt:'2027-09-30T23:59:00Z',
    });
    assert.equal(goal.status,'ACTIVE');
    await assert.rejects(()=>api.createGoal(req(owner!),academy.id,{
      courseId:foreignCourse.id,studentUserId:student!.id,
      title:'Meta de otro espacio',
    }),NotFoundException);
    await assert.rejects(()=>api.createGoal(req(student!),academy.id,{
      courseId:course.id,studentUserId:student!.id,title:'Meta propia',
    }),ForbiddenException);
    const achieved=await api.changeGoal(req(teacher!),academy.id,goal.id,{
      status:'ACHIEVED',reason:'Cumplió la meta con evidencia directa del profesor',
    });
    assert.equal(achieved.status,'ACHIEVED');
    assert.ok(achieved.completedAt);
    assert.equal((await api.changeGoal(req(teacher!),academy.id,goal.id,{
      status:'ACHIEVED',reason:'Solicitud repetida del docente',
    })).id,goal.id);
    await assert.rejects(()=>api.changeGoal(req(owner!),academy.id,goal.id,{
      status:'CANCELLED',reason:'Cambio de criterio',
    }),ConflictException);
    assert.equal(await prisma.learningGoalEvent.count({where:{goalId:goal.id}}),1);
    assert.equal((await api.student(req(student!),academy.id)).goals[0]?.status,'ACHIEVED');
    assert.equal((await api.student(req(visitor!),academy.id)).goals.length,0);

    await prisma.courseTeacher.deleteMany({where:{courseId:course.id,teacherId:profile.id}});
    await assert.rejects(()=>api.course(req(teacher!),academy.id,course.id),ForbiddenException);
    await assert.rejects(()=>api.evidence(req(teacher!),academy.id,{
      ...firstInput,requestId:randomUUID(),
    }),ForbiddenException);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
    await prisma.user.deleteMany({where:{id:{in:people.map(person=>person.id)}}});
    await prisma.$disconnect();
  }
});
