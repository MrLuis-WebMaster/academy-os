import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ForbiddenException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {ReminderPreferencesUseCases,DeliverDueReminders} from '../modules/notifications/application/reminder-use-cases.js';
import {PrismaReminderPreferences} from '../modules/notifications/infrastructure/prisma-reminder-preferences.js';
import {PrismaReminderDelivery} from '../modules/notifications/infrastructure/prisma-reminder-delivery.js';
import {ReminderPreferencesController} from '../modules/notifications/presentation/reminder-preferences.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string;name:string}):AuthenticatedRequest{
  return {academyUser:{id:user.id,email:user.email,name:user.name}} as unknown as AuthenticatedRequest;
}
const HOUR=3600000;
test('PostgreSQL reminders: opt-in, course membership, active booking and retry idempotence',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,12);
  const users=await Promise.all([
    prisma.user.create({data:{email:'rem-owner-'+nonce+'@example.invalid',name:'Owner'}}),
    prisma.user.create({data:{email:'rem-student-'+nonce+'@example.invalid',name:'Student'}}),
    prisma.user.create({data:{email:'rem-other-'+nonce+'@example.invalid',name:'Unenrolled student'}}),
    prisma.user.create({data:{email:'rem-foreign-'+nonce+'@example.invalid',name:'Foreign'}}),
  ]);
  const [owner,student,other,foreign]=users;
  const workspaceIds:string[]=[];
  try{
    const academy=await prisma.workspace.create({data:{
      slug:'reminder-a-'+nonce,name:'Reminder Academy',type:'ACADEMY',timezone:'America/Bogota',
      members:{create:[
        {userId:owner!.id,role:'OWNER'},
        {userId:student!.id,role:'STUDENT'},
        {userId:other!.id,role:'STUDENT'},
      ]},
    }});
    workspaceIds.push(academy.id);
    const unrelated=await prisma.workspace.create({data:{
      slug:'reminder-b-'+nonce,name:'Unrelated Academy',type:'ACADEMY',
      members:{create:{userId:foreign!.id,role:'STUDENT'}},
    }});
    workspaceIds.push(unrelated.id);
    const course=await prisma.course.create({data:{workspaceId:academy.id,title:'Curso de ciencias'}});
    await prisma.enrollment.create({data:{courseId:course.id,userId:student!.id}});
    const now=new Date('2027-01-01T10:00:00.000Z');
    const sessions=await Promise.all([
      prisma.classSession.create({data:{
        workspaceId:academy.id,courseId:course.id,title:'Clase en 24 horas',
        startsAt:new Date(now.getTime()+24*HOUR-5*60000),
        endsAt:new Date(now.getTime()+25*HOUR-5*60000),
        timezone:'America/Bogota',mode:'ONLINE',status:'CONFIRMED',
        meetingUrl:'https://meet.example.invalid/class-a',
      }}),
      prisma.classSession.create({data:{
        workspaceId:academy.id,courseId:course.id,title:'Clase en una hora',
        startsAt:new Date(now.getTime()+HOUR-5*60000),
        endsAt:new Date(now.getTime()+2*HOUR-5*60000),
        timezone:'America/Bogota',mode:'ONLINE',status:'CONFIRMED',
        meetingUrl:'https://meet.example.invalid/class-b',
      }}),
      prisma.classSession.create({data:{
        workspaceId:academy.id,courseId:course.id,title:'Clase cancelada',
        startsAt:new Date(now.getTime()+HOUR-10*60000),
        endsAt:new Date(now.getTime()+2*HOUR-10*60000),
        timezone:'America/Bogota',mode:'ONLINE',status:'CANCELLED',
        meetingUrl:'https://meet.example.invalid/class-c',
      }}),
    ]);
    for(const session of sessions){
      await prisma.classBooking.createMany({data:[
        {workspaceId:academy.id,userId:student!.id,sessionId:session.id,status:'BOOKED'},
        {workspaceId:academy.id,userId:other!.id,sessionId:session.id,status:'BOOKED'},
      ]});
    }
    const preferences=new ReminderPreferencesController(
      new ReminderPreferencesUseCases(new PrismaReminderPreferences(),new PrismaMembershipAdapter()),
    );
    const worker=new DeliverDueReminders(new PrismaReminderDelivery());
    assert.deepEqual(await preferences.read(req(student!),academy.id),{
      remind24h:false,remind1h:false,
    });
    await assert.rejects(()=>preferences.save(req(owner!),academy.id,{
      remind24h:true,remind1h:true,
    }),ForbiddenException);
    await assert.rejects(()=>preferences.save(req(foreign!),academy.id,{
      remind24h:true,remind1h:true,
    }),ForbiddenException);
    assert.equal((await worker.execute(now)).createdNotifications,0);
    assert.deepEqual(await preferences.save(req(student!),academy.id,{
      remind24h:true,remind1h:true,
    }),{remind24h:true,remind1h:true});
    await preferences.save(req(other!),academy.id,{remind24h:true,remind1h:true});
    const first=await worker.execute(now);
    assert.equal(first.createdNotifications,2);
    assert.equal((await worker.execute(now)).createdNotifications,0);
    assert.equal(await prisma.notification.count({where:{
      workspaceId:academy.id,userId:student!.id,kind:'CLASS_REMINDER',
    }}),2);
    assert.equal(await prisma.notification.count({where:{
      workspaceId:academy.id,userId:other!.id,kind:'CLASS_REMINDER',
    }}),0);
    assert.equal(await prisma.notification.count({where:{workspaceId:unrelated.id}}),0);

    // Revoked reservations cannot produce additional notices.
    await prisma.classBooking.update({
      where:{sessionId_userId:{sessionId:sessions[0]!.id,userId:student!.id}},
      data:{status:'CANCELLED',cancelledAt:new Date()},
    });
    await prisma.classSession.update({
      where:{id:sessions[0]!.id},
      data:{startsAt:new Date(now.getTime()+24*HOUR-8*60000)},
    });
    assert.equal((await worker.execute(now)).createdNotifications,0);

    // Removing opt-in prevents any new notices even if a class time changes.
    await preferences.save(req(student!),academy.id,{remind24h:false,remind1h:false});
    await prisma.classSession.update({
      where:{id:sessions[1]!.id},
      data:{startsAt:new Date(now.getTime()+HOUR-12*60000)},
    });
    assert.equal((await worker.execute(now)).createdNotifications,0);

    // Newly enrolled user can receive only their own reminders after opting in.
    await prisma.enrollment.create({data:{courseId:course.id,userId:other!.id}});
    assert.equal((await worker.execute(now)).createdNotifications,2);
    assert.equal((await worker.execute(now)).createdNotifications,0);
    assert.equal(await prisma.notification.count({where:{
      workspaceId:academy.id,userId:other!.id,kind:'CLASS_REMINDER',
    }}),2);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
    await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
    await prisma.$disconnect();
  }
});
