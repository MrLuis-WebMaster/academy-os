import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ForbiddenException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {requireMembership} from '../workspaces/access.js';
import {CoursesController} from '../modules/academics/presentation/courses.controller.js';
import {CourseUseCases} from '../modules/academics/application/course-use-cases.js';
import {PrismaCourseRepository} from '../modules/academics/infrastructure/prisma-course-repository.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {BookingActionsController} from '../modules/scheduling/presentation/booking-actions.controller.js';
import {BookingUseCases} from '../modules/scheduling/application/booking-use-cases.js';
import {PrismaBookingRepository} from '../modules/scheduling/infrastructure/prisma-booking-repository.js';
import {FinanceController} from '../finance/controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function request(userId:string){
  return {academyUser:{id:userId,email:'test@example.invalid',name:'Test'}} as unknown as AuthenticatedRequest;
}

test('PostgreSQL multi-tenant guards and booking capacity',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,14);
  const owner=await prisma.user.create({data:{email:'owner-'+nonce+'@example.invalid',name:'Workspace Owner'}});
  const student1=await prisma.user.create({data:{email:'one-'+nonce+'@example.invalid',name:'Student One'}});
  const student2=await prisma.user.create({data:{email:'two-'+nonce+'@example.invalid',name:'Student Two'}});
  const users=[owner.id,student1.id,student2.id];
  const ids:string[]=[];
  try{
    const a=await prisma.workspace.create({
      data:{slug:'teacher-'+nonce,name:'Teacher A',type:'SOLO',members:{create:{userId:owner.id,role:'OWNER'}}},
    });
    ids.push(a.id);
    const b=await prisma.workspace.create({
      data:{
        slug:'academy-'+nonce,name:'Academy B',type:'ACADEMY',
        members:{create:[{userId:student1.id,role:'STUDENT'},{userId:student2.id,role:'STUDENT'}]},
        subjects:{create:{name:'Math',slug:'math'}},
      },
    });
    ids.push(b.id);
    await assert.rejects(()=>requireMembership(b.id,owner.id),ForbiddenException);
    await assert.rejects(()=>new CoursesController(new CourseUseCases(new PrismaCourseRepository(),new PrismaMembershipAdapter())).list(request(owner.id),b.id),ForbiddenException);
    await assert.rejects(()=>new FinanceController().receipts(request(student1.id),b.id),ForbiddenException);
    const course=await prisma.course.create({data:{workspaceId:b.id,title:'Curso práctico'}});
    const subject=await prisma.subject.findFirstOrThrow({where:{workspaceId:b.id}});
    assert.equal(subject.name,'Math');
    await prisma.enrollment.createMany({data:[
      {courseId:course.id,userId:student1.id},
      {courseId:course.id,userId:student2.id},
    ]});
    const startsAt=new Date(Date.now()+3*24*60*60*1000);
    const endsAt=new Date(startsAt.getTime()+60*60*1000);
    const session=await prisma.classSession.create({
      data:{
        workspaceId:b.id,courseId:course.id,title:'Taller 1',mode:'ONLINE',
        status:'CONFIRMED',startsAt,endsAt,timezone:'America/Bogota',
        capacity:1,meetingUrl:'https://meet.example.invalid/test',
      },
    });
    const bookingActions=new BookingActionsController(new BookingUseCases(new PrismaBookingRepository(),new PrismaMembershipAdapter()));
    const reservations=await Promise.allSettled([
      bookingActions.reserve(request(student1.id),b.id,{sessionId:session.id}),
      bookingActions.reserve(request(student2.id),b.id,{sessionId:session.id}),
    ]);
    assert.equal(reservations.filter(r=>r.status==='fulfilled').length,1, 'only one student can reserve the last seat: '+JSON.stringify(reservations.map(r=>r.status==='rejected'?String(r.reason):'ok')));
    assert.equal(reservations.filter(r=>r.status==='rejected').length,1);
    assert.equal(await prisma.classBooking.count({where:{sessionId:session.id,status:'BOOKED'}}),1);
    await assert.rejects(()=>bookingActions.reserve(request(owner.id),b.id,{sessionId:session.id}),ForbiddenException);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:ids}}});
    await prisma.user.deleteMany({where:{id:{in:users}}});
    await prisma.$disconnect();
  }
});
