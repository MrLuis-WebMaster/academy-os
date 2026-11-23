import {prisma} from '../../../lib/prisma.js';
import {bookingNotice} from '../../notifications/domain/notification.js';
import {notifyUser} from '../../notifications/infrastructure/personal-notice-publisher.js';
import type {SeriesBookingRepository} from '../application/series-booking-ports.js';
import {
  SeriesBookingAccessDenied,SeriesBookingConflict,SeriesBookingNotEnrolled,SeriesBookingNotFound,
} from '../application/series-booking-use-cases.js';

/** The same booking locks are used by series cancellation and rescheduling.
 * Never partially reserve a series. A full series succeeds or rolls back as a unit.
 */
export class PrismaSeriesBookingRepository implements SeriesBookingRepository {
  private async withFutureSeries(
    workspaceId:string,userId:string,seriesId:string,
    op:(tx:Parameters<Parameters<typeof prisma.$transaction>[0]>[0],sessions:Array<{
      id:string;title:string;courseId:string|null;startsAt:Date;
      status:'DRAFT'|'CONFIRMED'|'COMPLETED'|'CANCELLED';capacity:number;
    }>)=>Promise<any>,
  ){
    return prisma.$transaction(async tx=>{
      // Revalidate membership after acquiring the series lock, not just in the use case.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:series-bookings:'+seriesId}))::text AS lock_acquired`;
      const [series,student]=await Promise.all([
        tx.classSeries.findFirst({where:{workspaceId,id:seriesId},select:{id:true}}),
        tx.workspaceMember.findFirst({
          where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
        }),
      ]);
      if(!series)throw new SeriesBookingNotFound();
      if(!student)throw new SeriesBookingAccessDenied();
      const now=new Date();
      const candidate=await tx.classSession.findMany({
        where:{workspaceId,seriesId,status:'CONFIRMED',startsAt:{gt:now}},
        select:{id:true},orderBy:{id:'asc'},
      });
      if(!candidate.length)throw new SeriesBookingConflict('No future confirmed classes remain in this series');
      // Consistent advisory lock order with cancel-future and reschedule.
      for(const item of candidate){
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+item.id}))::text AS lock_acquired`;
      }
      const latest=await tx.classSession.findMany({
        where:{workspaceId,seriesId,status:'CONFIRMED',startsAt:{gt:new Date()}},
        select:{id:true,title:true,courseId:true,startsAt:true,status:true,capacity:true},
        orderBy:{id:'asc'},
      });
      if(latest.length!==candidate.length
        ||latest.some((item,i)=>item.id!==candidate[i]?.id))
        throw new SeriesBookingConflict('The series schedule changed; refresh and retry');
      return op(tx,latest);
    },{timeout:20000});
  }

  async reserveFuture(workspaceId:string,userId:string,seriesId:string){
    return this.withFutureSeries(workspaceId,userId,seriesId,async(tx,sessions)=>{
      const courseIds=[...new Set(sessions.map(s=>s.courseId).filter((id):id is string=>Boolean(id)))];
      if(sessions.some(s=>!s.courseId)||courseIds.length!==1)
        throw new SeriesBookingNotEnrolled();
      const enrolled=await tx.enrollment.findFirst({
        where:{courseId:courseIds[0]!,userId,course:{workspaceId}},
        select:{id:true},
      });
      if(!enrolled)throw new SeriesBookingNotEnrolled();
      const current=await tx.classBooking.findMany({
        where:{workspaceId,userId,sessionId:{in:sessions.map(s=>s.id)}},
        select:{id:true,sessionId:true,status:true},
      });
      const bySession=new Map(current.map(item=>[item.sessionId,item]));
      // Preflight ALL seats before writing any booking or notification.
      for(const session of sessions){
        if(bySession.get(session.id)?.status==='BOOKED')continue;
        const occupied=await tx.classBooking.count({
          where:{workspaceId,sessionId:session.id,status:'BOOKED'},
        });
        if(occupied>=session.capacity)
          throw new SeriesBookingConflict('Series booking failed: the class "'+session.title+'" has no seats');
      }
      let booked=0,alreadyBooked=0,inAppNotificationsCreated=0;
      for(const session of sessions){
        const previous=bySession.get(session.id);
        if(previous?.status==='BOOKED'){alreadyBooked++;continue;}
        const stamp=new Date();
        const record=previous
          ?await tx.classBooking.update({
            where:{id:previous.id},
            data:{status:'BOOKED',bookedAt:stamp,cancelledAt:null},
            select:{id:true,bookedAt:true},
          })
          :await tx.classBooking.create({
            data:{workspaceId,sessionId:session.id,userId},
            select:{id:true,bookedAt:true},
          });
        booked++;
        inAppNotificationsCreated+=await notifyUser(tx,{
          workspaceId,userId,sessionId:session.id,kind:'BOOKING_CONFIRMED',
          eventKey:'booking:'+record.id+':'+record.bookedAt.toISOString(),
          ...bookingNotice(session.title),
        });
      }
      return {seriesId,total:sessions.length,booked,alreadyBooked,inAppNotificationsCreated};
    });
  }

  async cancelFuture(workspaceId:string,userId:string,seriesId:string){
    return this.withFutureSeries(workspaceId,userId,seriesId,async(tx,sessions)=>{
      const result=await tx.classBooking.updateMany({
        where:{
          workspaceId,userId,status:'BOOKED',
          sessionId:{in:sessions.map(item=>item.id)},
        },
        data:{status:'CANCELLED',cancelledAt:new Date()},
      });
      return {seriesId,cancelledBookings:result.count};
    });
  }
}
