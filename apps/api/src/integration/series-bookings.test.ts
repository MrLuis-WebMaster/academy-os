import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {SeriesBookingUseCases} from '../modules/scheduling/application/series-booking-use-cases.js';
import {PrismaSeriesBookingRepository} from '../modules/scheduling/infrastructure/prisma-series-booking-repository.js';
import {SeriesBookingsController} from '../modules/scheduling/presentation/series-bookings.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string}):AuthenticatedRequest {
  return {academyUser:{id:user.id,email:user.email,name:user.email}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL recurring bookings: full-or-none, capacity, tenancy and idempotent cancel',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,14);
  const [owner,studentOne,studentTwo,stranger]=await Promise.all([
    prisma.user.create({data:{email:'series-owner-'+nonce+'@example.invalid',name:'Owner'}}),
    prisma.user.create({data:{email:'series-student1-'+nonce+'@example.invalid',name:'Student One'}}),
    prisma.user.create({data:{email:'series-student2-'+nonce+'@example.invalid',name:'Student Two'}}),
    prisma.user.create({data:{email:'series-stranger-'+nonce+'@example.invalid',name:'Stranger'}}),
  ]);
  const users=[owner,studentOne,studentTwo,stranger];
  const workspaces:string[]=[];
  try{
    const academy=await prisma.workspace.create({data:{
      slug:'series-bookings-'+nonce,name:'Series Booking Academy',type:'ACADEMY',
      members:{create:[
        {userId:owner.id,role:'OWNER'},
        {userId:studentOne.id,role:'STUDENT'},
        {userId:studentTwo.id,role:'STUDENT'},
      ]},
    }});
    workspaces.push(academy.id);
    const foreign=await prisma.workspace.create({data:{
      slug:'other-series-bookings-'+nonce,name:'Foreign academy',type:'ACADEMY',
      members:{create:{userId:stranger.id,role:'STUDENT'}},
    }});
    workspaces.push(foreign.id);
    const profile=await prisma.teacherProfile.create({data:{workspaceId:academy.id,userId:owner.id}});
    const course=await prisma.course.create({data:{workspaceId:academy.id,title:'Mathematics'}});

    await prisma.enrollment.createMany({data:[
      {courseId:course.id,userId:studentOne.id},
      {courseId:course.id,userId:studentTwo.id},
    ]});
    const start=new Date(Date.now()+5*86400000);
    start.setUTCHours(15,0,0,0);
    const series=await prisma.classSeries.create({data:{
      workspaceId:academy.id,teacherProfileId:profile.id,createdByUserId:owner.id,
      firstStartsAt:start,repeatWeeks:3,timezone:'America/Bogota',
    }});
    const sessions=await Promise.all([0,1,2].map(index=>{
      const startsAt=new Date(start.getTime()+index*7*86400000);
      return prisma.classSession.create({data:{
        workspaceId:academy.id,seriesId:series.id,seriesIndex:index,courseId:course.id,
        teacherProfileId:profile.id,title:'Class '+(index+1),mode:'ONLINE',
        startsAt,endsAt:new Date(startsAt.getTime()+3600000),timezone:'America/Bogota',
        status:'CONFIRMED',capacity:1,meetingUrl:'https://meet.example.invalid/abc',
      }});
    }));

    const api=new SeriesBookingsController(
      new SeriesBookingUseCases(new PrismaSeriesBookingRepository(),new PrismaMembershipAdapter()),
    );
    await assert.rejects(()=>api.reserve(req(owner),academy.id,{seriesId:series.id}),ForbiddenException);
    await assert.rejects(()=>api.reserve(req(stranger),foreign.id,{seriesId:series.id}),NotFoundException);
    await assert.rejects(()=>api.cancelFuture(req(stranger),foreign.id,series.id),NotFoundException);

    // If any class is occupied, the transaction rolls back the whole series.
    await prisma.classBooking.create({data:{
      workspaceId:academy.id,sessionId:sessions[2]!.id,userId:studentTwo.id,
    }});
    await assert.rejects(()=>api.reserve(req(studentOne),academy.id,{seriesId:series.id}),ConflictException);
    assert.equal(await prisma.classBooking.count({where:{
      workspaceId:academy.id,userId:studentOne.id,
    }}),0);
    await prisma.classBooking.delete({where:{
      sessionId_userId:{sessionId:sessions[2]!.id,userId:studentTwo.id},
    }});

    // Two simultaneous students compete for the same whole series: one wins all seats.
    const results=await Promise.allSettled([
      api.reserve(req(studentOne),academy.id,{seriesId:series.id}),
      api.reserve(req(studentTwo),academy.id,{seriesId:series.id}),
    ]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.ok(results.some(result=>result.status==='rejected'&&result.reason instanceof ConflictException));
    const winner=results[0]!.status==='fulfilled'?studentOne:studentTwo;
    const loser=winner.id===studentOne.id?studentTwo:studentOne;
    assert.equal(await prisma.classBooking.count({where:{
      workspaceId:academy.id,userId:winner.id,status:'BOOKED',
    }}),3);
    assert.equal(await prisma.classBooking.count({where:{
      workspaceId:academy.id,userId:loser.id,status:'BOOKED',
    }}),0);
    assert.equal((await api.reserve(req(winner),academy.id,{seriesId:series.id})).alreadyBooked,3);
    assert.equal(await prisma.notification.count({where:{
      workspaceId:academy.id,userId:winner.id,kind:'BOOKING_CONFIRMED',
    }}),3);

    const cancelled=await api.cancelFuture(req(winner),academy.id,series.id);
    assert.deepEqual(cancelled,{seriesId:series.id,cancelledBookings:3});
    assert.equal((await api.cancelFuture(req(winner),academy.id,series.id)).cancelledBookings,0);
    assert.equal((await api.reserve(req(loser),academy.id,{seriesId:series.id})).booked,3);
    assert.equal(await prisma.classBooking.count({where:{
      workspaceId:academy.id,userId:loser.id,status:'BOOKED',
    }}),3);
    assert.equal(await prisma.notification.count({where:{
      workspaceId:foreign.id,
    }}),0);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaces}}});
    await prisma.user.deleteMany({where:{id:{in:users.map(user=>user.id)}}});
    await prisma.$disconnect();
  }
});
