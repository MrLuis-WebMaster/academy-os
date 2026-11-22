import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {requireMembership} from '../workspaces/access.js';
import {CoursesController} from '../modules/academics/presentation/courses.controller.js';
import {CourseUseCases} from '../modules/academics/application/course-use-cases.js';
import {PrismaCourseRepository} from '../modules/academics/infrastructure/prisma-course-repository.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {BookingActionsController} from '../modules/scheduling/presentation/booking-actions.controller.js';
import {BookingUseCases} from '../modules/scheduling/application/booking-use-cases.js';
import {PrismaBookingRepository} from '../modules/scheduling/infrastructure/prisma-booking-repository.js';
import {notifyBookedStudents} from '../modules/notifications/infrastructure/session-notice-publisher.js';
import {NotificationUseCases} from '../modules/notifications/application/notification-use-cases.js';
import {PrismaNotificationMailbox} from '../modules/notifications/infrastructure/prisma-notification-mailbox.js';
import {NotificationsController} from '../modules/notifications/presentation/notifications.controller.js';
import {ExportCalendarUseCase,CalendarAccessDenied} from '../modules/calendar/application/export-calendar-use-case.js';
import {PrismaCalendarReadRepository} from '../modules/calendar/infrastructure/prisma-calendar-read-repository.js';
import {EnrollmentsController} from '../modules/academics/presentation/enrollments.controller.js';
import {EnrollmentUseCases} from '../modules/academics/application/enrollment-use-cases.js';
import {PrismaEnrollmentRepository} from '../modules/academics/infrastructure/prisma-enrollment-repository.js';
import {FinanceController} from '../modules/finance/presentation/finance.controller.js';
import {AttendanceController} from '../modules/attendance/presentation/attendance.controller.js';
import {AttendanceUseCases} from '../modules/attendance/application/attendance-use-cases.js';
import {PrismaAttendanceRepository} from '../modules/attendance/infrastructure/prisma-attendance-repository.js';
import {FinanceUseCases} from '../modules/finance/application/finance-use-cases.js';
import {PrismaFinanceRepository} from '../modules/finance/infrastructure/prisma-finance-repository.js';
import {BadRequestException} from '@nestjs/common';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function request(userId:string){
  return {academyUser:{id:userId,email:'test@example.invalid',name:'Test'}} as unknown as AuthenticatedRequest;
}

test('PostgreSQL multi-tenant guards and booking capacity',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,14);
  const owner=await prisma.user.create({data:{email:'owner-'+nonce+'@example.invalid',name:'Workspace Owner'}});
  const student1=await prisma.user.create({data:{email:'one-'+nonce+'@example.invalid',name:'Student One'}});
  const student2=await prisma.user.create({data:{email:'two-'+nonce+'@example.invalid',name:'Student Two'}});
  const teacherOne=await prisma.user.create({data:{email:'teacher-one-'+nonce+'@example.invalid',name:'Teacher One'}});
  const teacherTwo=await prisma.user.create({data:{email:'teacher-two-'+nonce+'@example.invalid',name:'Teacher Two'}});
  const users=[owner.id,student1.id,student2.id,teacherOne.id,teacherTwo.id];
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
    const finance=new FinanceController(
      new FinanceUseCases(new PrismaFinanceRepository(),new PrismaMembershipAdapter()),
    );
    await assert.rejects(()=>finance.receipts(request(student1.id),b.id),ForbiddenException);
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
    // A class event creates an in-app notification for exactly the booked student,
    // never for the entire academy or for students who lost the final seat.
    const recipient=await prisma.classBooking.findFirstOrThrow({
      where:{sessionId:session.id,status:'BOOKED'},select:{userId:true},
    });
    const notBooked=recipient.userId===student1.id?student2.id:student1.id;
    const notificationEvent={
      workspaceId:b.id,sessionId:session.id,sessionTitle:session.title,
      kind:'SESSION_RESCHEDULED' as const,eventKey:'session-change-1',
    };
    assert.equal(await prisma.$transaction(tx=>notifyBookedStudents(tx,notificationEvent)),1);
    assert.equal(await prisma.$transaction(tx=>notifyBookedStudents(tx,notificationEvent)),0);
    const notices=new NotificationsController(
      new NotificationUseCases(new PrismaNotificationMailbox(),new PrismaMembershipAdapter()),
    );
    const myInbox=await notices.list(request(recipient.userId),b.id);
    assert.equal(myInbox.unreadCount,2); // booking confirmation and class change
    assert.equal(myInbox.items.length,2);
    assert.equal((await notices.list(request(notBooked),b.id)).items.length,0);
    await assert.rejects(()=>notices.list(request(owner.id),b.id),ForbiddenException);
    const changed=myInbox.items.find(n=>n.kind==='SESSION_RESCHEDULED');
    const bookedNotice=myInbox.items.find(n=>n.kind==='BOOKING_CONFIRMED');
    assert.ok(changed&&bookedNotice);
    await assert.rejects(()=>notices.read(request(notBooked),b.id,changed!.id),NotFoundException);
    await notices.read(request(recipient.userId),b.id,changed!.id);
    assert.equal((await notices.list(request(recipient.userId),b.id)).unreadCount,1);
    await notices.readAll(request(recipient.userId),b.id);
    assert.equal((await notices.list(request(recipient.userId),b.id)).unreadCount,0);
    // Real DB access: a student only exports sessions they personally booked.
    const calendar=new ExportCalendarUseCase(new PrismaCalendarReadRepository());
    const bookedCalendar=await calendar.execute(b.id,recipient.userId);
    const otherCalendar=await calendar.execute(b.id,notBooked);
    assert.match(bookedCalendar,/SUMMARY:Taller 1/);
    assert.equal(otherCalendar.includes('SUMMARY:Taller 1'),false);
    await assert.rejects(()=>calendar.execute(b.id,owner.id),CalendarAccessDenied);
    // Owner of academy A enrolls a member of both academies; the confirmation
    // must be visible in A only, never leak into their B notification feed.
    await prisma.workspaceMember.create({
      data:{workspaceId:a.id,userId:student1.id,role:'STUDENT'},
    });
    const courseA=await prisma.course.create({data:{workspaceId:a.id,title:'Taller privado A'}});
    const enrollments=new EnrollmentsController(
      new EnrollmentUseCases(new PrismaEnrollmentRepository(),new PrismaMembershipAdapter()),
    );
    await enrollments.enroll(request(owner.id),a.id,{
      courseId:courseA.id,studentUserId:student1.id,
    });
    // Real PostgreSQL: financial receipts cannot link a student to a course of
    // another academy, even if the same student is a member of both academies.
    await assert.rejects(()=>finance.record(request(owner.id),a.id,{
      studentUserId:student1.id,courseId:course.id,amountCOP:42000,method:'CASH',
    }),BadRequestException);
    assert.equal(await prisma.paymentReceipt.count({where:{workspaceId:a.id}}),0);
    const payment=await finance.record(request(owner.id),a.id,{
      studentUserId:student1.id,courseId:courseA.id,amountCOP:42000,method:'CASH',
    });
    assert.equal(payment.amountCOP,42000);
    assert.equal((await finance.summary(request(owner.id),a.id)).totalReceivedCOP,42000);
    await assert.rejects(()=>finance.voidReceipt(request(student1.id),a.id,payment.id,{
      reason:'Pago duplicado',
    }),ForbiddenException);
    await assert.rejects(()=>finance.voidReceipt(request(owner.id),b.id,payment.id,{
      reason:'Pago duplicado',
    }),ForbiddenException);
    await finance.voidReceipt(request(owner.id),a.id,payment.id,{reason:'Pago duplicado'});
    assert.equal((await finance.summary(request(owner.id),a.id)).totalReceivedCOP,0);
    assert.equal(await prisma.paymentReceipt.count({where:{workspaceId:b.id}}),0);

    const studentAInbox=await notices.list(request(student1.id),a.id);
    assert.equal(studentAInbox.items.length,1);
    assert.equal(studentAInbox.items[0]!.kind,'COURSE_ENROLLED');
    assert.equal((await notices.list(request(student1.id),b.id)).items.some(n=>n.kind==='COURSE_ENROLLED'),false);



    await assert.rejects(()=>bookingActions.reserve(request(owner.id),b.id,{sessionId:session.id}),ForbiddenException);

    // Real PostgreSQL: teachers can only see and mark their own academy sessions.
    // This validates the actual Prisma adapter, not only an in-memory fake.
    await prisma.workspaceMember.createMany({data:[
      {workspaceId:b.id,userId:teacherOne.id,role:'TEACHER'},
      {workspaceId:b.id,userId:teacherTwo.id,role:'TEACHER'},
    ]});
    const teacherProfile=await prisma.teacherProfile.create({
      data:{workspaceId:b.id,userId:teacherOne.id},
    });
    await prisma.classSession.update({
      where:{id:session.id},data:{teacherProfileId:teacherProfile.id},
    });
    const attendance=new AttendanceController(
      new AttendanceUseCases(new PrismaAttendanceRepository(),new PrismaMembershipAdapter()),
    );
    const activeBooking=await prisma.classBooking.findFirstOrThrow({
      where:{workspaceId:b.id,sessionId:session.id,status:'BOOKED'},
      select:{id:true},
    });
    await assert.rejects(()=>attendance.staff(request(recipient.userId),b.id),ForbiddenException);
    await assert.rejects(()=>attendance.staff(request(owner.id),b.id),ForbiddenException);
    assert.equal((await attendance.staff(request(owner.id),a.id)).length,0);
    assert.equal((await attendance.staff(request(teacherTwo.id),b.id)).length,0);
    const staffRows=await attendance.staff(request(teacherOne.id),b.id);
    assert.equal(staffRows.length,1);
    assert.equal(staffRows[0]?.id,activeBooking.id);
    await assert.rejects(()=>attendance.mark(request(teacherTwo.id),b.id,activeBooking.id,{attendance:'ABSENT'}),ForbiddenException);
    await assert.rejects(()=>attendance.mark(request(owner.id),a.id,activeBooking.id,{attendance:'ABSENT'}),NotFoundException);
    assert.deepEqual(await attendance.mark(request(teacherOne.id),b.id,activeBooking.id,{attendance:'PRESENT'}),{
      id:activeBooking.id,attendance:'PRESENT',
    });
    assert.equal((await prisma.classBooking.findUniqueOrThrow({
      where:{id:activeBooking.id},select:{attendance:true},
    })).attendance,'PRESENT');
    await prisma.classSession.update({
      where:{id:session.id},data:{status:'CANCELLED'},
    });
    await assert.rejects(()=>attendance.mark(request(teacherOne.id),b.id,activeBooking.id,{attendance:'LATE'}),ConflictException);
    assert.equal((await prisma.classBooking.findUniqueOrThrow({
      where:{id:activeBooking.id},select:{attendance:true},
    })).attendance,'PRESENT');
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:ids}}});
    await prisma.user.deleteMany({where:{id:{in:users}}});
    await prisma.$disconnect();
  }
});
