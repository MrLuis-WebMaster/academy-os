import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {LessonUseCases} from '../modules/scheduling/application/lesson-use-cases.js';
import {PrismaLessonRepository} from '../modules/scheduling/infrastructure/prisma-lesson-repository.js';
import {LessonsController} from '../modules/scheduling/presentation/lessons.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function request(id:string):AuthenticatedRequest {
  return {academyUser:{id,email:'test@example.invalid',name:'Test'}} as unknown as AuthenticatedRequest;
}
const day=24*60*60*1000;
function atDay(base:Date,offset:number):Date {
  return new Date(base.getTime()+offset*day);
}
function draft(teacherProfileId:string,courseId:string,startsAt:Date){
  return {
    title:'Clase de integración',teacherProfileId,courseId,mode:'ONLINE' as const,
    startsAt:startsAt.toISOString(),endsAt:new Date(startsAt.getTime()+60*60*1000).toISOString(),
    capacity:2,meetingUrl:'https://meet.example.invalid/integration',
  };
}

test('PostgreSQL lessons: teacher isolation, schedule locks and atomic cancellation notices',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,14);
  const [ownerA,ownerB,teacherOne,teacherTwo,student]=await Promise.all([
    prisma.user.create({data:{email:'lessons-owner-a-'+nonce+'@example.invalid',name:'Owner A'}}),
    prisma.user.create({data:{email:'lessons-owner-b-'+nonce+'@example.invalid',name:'Owner B'}}),
    prisma.user.create({data:{email:'lessons-teacher-one-'+nonce+'@example.invalid',name:'Teacher One'}}),
    prisma.user.create({data:{email:'lessons-teacher-two-'+nonce+'@example.invalid',name:'Teacher Two'}}),
    prisma.user.create({data:{email:'lessons-student-'+nonce+'@example.invalid',name:'Student'}}),
  ]);
  const userIds=[ownerA.id,ownerB.id,teacherOne.id,teacherTwo.id,student.id];
  const workspaceIds:string[]=[];
  const lessons=new LessonsController(
    new LessonUseCases(new PrismaLessonRepository(),new PrismaMembershipAdapter()),
  );
  const startsAt=new Date(Date.now()+12*day);
  startsAt.setUTCHours(15,0,0,0); // 10:00 in America/Bogota, regardless of test runner timezone.
  try{
    const academy=await prisma.workspace.create({
      data:{
        name:'Lessons academy',slug:'lessons-a-'+nonce,type:'ACADEMY',
        timezone:'America/Bogota',members:{create:[
          {userId:ownerA.id,role:'OWNER'},
          {userId:teacherOne.id,role:'TEACHER'},
          {userId:teacherTwo.id,role:'TEACHER'},
          {userId:student.id,role:'STUDENT'},
        ]},
      },
    });
    workspaceIds.push(academy.id);
    const foreign=await prisma.workspace.create({
      data:{
        name:'Unrelated academy',slug:'lessons-b-'+nonce,type:'ACADEMY',
        members:{create:{userId:ownerB.id,role:'OWNER'}},
      },
    });
    workspaceIds.push(foreign.id);
    const [profileOne,profileTwo,foreignProfile]=await Promise.all([
      prisma.teacherProfile.create({data:{workspaceId:academy.id,userId:teacherOne.id}}),
      prisma.teacherProfile.create({data:{workspaceId:academy.id,userId:teacherTwo.id}}),
      prisma.teacherProfile.create({data:{workspaceId:foreign.id,userId:ownerB.id}}),
    ]);
    const [course,foreignCourse]=await Promise.all([
      prisma.course.create({data:{workspaceId:academy.id,title:'Seguridad de clases'}}),
      prisma.course.create({data:{workspaceId:foreign.id,title:'No pertenece a esta academia'}}),
    ]);
    const firstDraft=draft(profileOne.id,course.id,startsAt);

    await assert.rejects(()=>lessons.list(request(student.id),academy.id),ForbiddenException);
    await assert.rejects(()=>lessons.create(request(student.id),academy.id,firstDraft),ForbiddenException);
    await assert.rejects(()=>lessons.create(request(teacherTwo.id),academy.id,firstDraft),ForbiddenException);
    await assert.rejects(()=>lessons.create(request(ownerA.id),academy.id,{
      ...firstDraft,teacherProfileId:foreignProfile.id,
    }),BadRequestException);
    await assert.rejects(()=>lessons.create(request(ownerA.id),academy.id,{
      ...firstDraft,courseId:foreignCourse.id,
    }),BadRequestException);
    assert.equal(await prisma.classSession.count({where:{workspaceId:academy.id}}),0);

    const first=await lessons.create(request(teacherOne.id),academy.id,firstDraft);
    assert.equal(first.status,'CONFIRMED');
    const colleague=await lessons.create(request(teacherTwo.id),academy.id,
      draft(profileTwo.id,course.id,startsAt));
    assert.equal((await lessons.list(request(teacherOne.id),academy.id)).length,1);
    const secondTeacherSessions=await lessons.list(request(teacherTwo.id),academy.id);
    assert.equal(secondTeacherSessions.length,1);
    assert.equal(secondTeacherSessions[0]?.id,colleague.id);
    assert.equal((await lessons.list(request(ownerA.id),academy.id)).length,2);
    assert.equal((await lessons.list(request(ownerB.id),foreign.id)).length,0);
    await assert.rejects(()=>lessons.cancel(request(ownerB.id),foreign.id,first.id),NotFoundException);
    await assert.rejects(()=>lessons.cancel(request(teacherTwo.id),academy.id,first.id),ForbiddenException);

    // Both requests compete for the same teacher at an identical time.
    // The advisory lock ensures exactly one confirmed class.
    const simultaneousStart=atDay(startsAt,2);
    const simultaneous=draft(profileOne.id,course.id,simultaneousStart);
    const results=await Promise.allSettled([
      lessons.create(request(ownerA.id),academy.id,simultaneous),
      lessons.create(request(teacherOne.id),academy.id,simultaneous),
    ]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1,
      'Only one concurrent class should be confirmed');
    assert.equal(results.filter(r=>r.status==='rejected').length,1);
    assert.ok(results.some(r=>r.status==='rejected'&&r.reason instanceof ConflictException));
    assert.equal(await prisma.classSession.count({
      where:{workspaceId:academy.id,teacherProfileId:profileOne.id,
        startsAt:simultaneousStart,status:'CONFIRMED'},
    }),1);

    // Configured availability restricts an otherwise free slot.
    const availabilityStart=atDay(startsAt,4);
    const localDay=new Date(availabilityStart.getTime()-5*60*60*1000).getUTCDay();
    await prisma.weeklyAvailability.create({
      data:{
        workspaceId:academy.id,teacherProfileId:profileOne.id,
        dayOfWeek:localDay,startMinute:9*60,endMinute:12*60,
      },
    });
    await assert.rejects(()=>lessons.create(request(ownerA.id),academy.id,
      draft(profileOne.id,course.id,new Date(availabilityStart.getTime()+5*60*60*1000))
    ),ConflictException);

    const absenceStarts=atDay(startsAt,6);
    await prisma.teacherTimeOff.create({
      data:{
        workspaceId:academy.id,teacherProfileId:profileOne.id,
        createdByUserId:ownerA.id,startsAt:absenceStarts,
        endsAt:new Date(absenceStarts.getTime()+2*60*60*1000),reason:'Ausencia programada',
      },
    });
    await assert.rejects(()=>lessons.create(request(ownerA.id),academy.id,
      draft(profileOne.id,course.id,absenceStarts)
    ),ConflictException);

    await prisma.enrollment.create({data:{courseId:course.id,userId:student.id}});
    await prisma.classBooking.create({
      data:{workspaceId:academy.id,sessionId:first.id,userId:student.id,status:'BOOKED'},
    });
    assert.deepEqual(await lessons.cancel(request(teacherOne.id),academy.id,first.id),{
      id:first.id,status:'CANCELLED',inAppNotificationsCreated:1,
    });
    assert.deepEqual(await lessons.cancel(request(ownerA.id),academy.id,first.id),{
      id:first.id,status:'CANCELLED',inAppNotificationsCreated:0,
    });
    assert.equal(await prisma.notification.count({
      where:{workspaceId:academy.id,sessionId:first.id,eventKey:'cancelled:'+first.id,userId:student.id},
    }),1);
    assert.equal(await prisma.notification.count({where:{workspaceId:foreign.id}}),0);

    await prisma.classSession.update({where:{id:colleague.id},data:{status:'COMPLETED'}});
    await assert.rejects(()=>lessons.cancel(request(ownerA.id),academy.id,colleague.id),BadRequestException);
    assert.equal((await prisma.classSession.findUniqueOrThrow({
      where:{id:colleague.id},select:{status:true},
    })).status,'COMPLETED');
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
    await prisma.user.deleteMany({where:{id:{in:userIds}}});
    await prisma.$disconnect();
  }
});
