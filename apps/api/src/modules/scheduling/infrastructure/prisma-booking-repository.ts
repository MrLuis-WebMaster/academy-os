import {prisma} from '../../../lib/prisma.js';
import type {BookingReservationPort} from '../application/booking-ports.js';
import {BookingPolicyViolation,ensureReservable,ensureCancellable} from '../domain/booking-policy.js';
import {BookingCourseNotAllowed,BookingMissing,BookingCapacityConflict} from '../application/booking-use-cases.js';
import {bookingNotice} from '../../notifications/domain/notification.js';
import {refundBookingCredit} from '../../commerce/infrastructure/package-credits.js';
import {reserveBookingCredit,PackageCreditRequired} from '../../commerce/infrastructure/reserve-booking-credit.js';
import {notifyUser} from '../../notifications/infrastructure/personal-notice-publisher.js';

export class PrismaBookingRepository implements BookingReservationPort {
  async reserve(workspaceId:string,sessionId:string,userId:string){
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+sessionId}))::text AS lock_acquired`;
      const session=await tx.classSession.findFirst({
        where:{id:sessionId,workspaceId},
        select:{id:true,title:true,courseId:true,capacity:true,status:true,startsAt:true,
          course:{select:{requiresPackage:true}}},
      });
      if(!session)throw new BookingMissing();
      if(session.courseId){
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:course-policy:'+session.courseId}))::text AS lock_acquired`;
      }
      const enrolled=session.courseId
        ? await tx.enrollment.findFirst({
          where:{courseId:session.courseId,userId,course:{workspaceId}},
          select:{id:true},
        })
        :null;
      const student=await tx.workspaceMember.findFirst({
        where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
      });
      if(!enrolled||!student)throw new BookingCourseNotAllowed();
      // An existing booking must be idempotent even when all seats are now occupied.
      const previous=await tx.classBooking.findUnique({
        where:{sessionId_userId:{sessionId,userId}},select:{id:true,status:true},
      });
      if(previous?.status==='BOOKED'){
        if(session.status!=='CONFIRMED')throw new BookingCapacityConflict('Class is no longer open');
        if(session.course?.requiresPackage){
          const credit=await tx.classPackageRedemption.findUnique({
            where:{bookingId:previous.id},select:{id:true,refundedAt:true},
          });
          if(!credit||credit.refundedAt)throw new BookingCapacityConflict('A valid package credit is required');
        }
        return {id:previous.id,sessionId,status:'BOOKED' as const,alreadyBooked:true};
      }
      const occupied=await tx.classBooking.count({where:{sessionId,status:'BOOKED'}});
      try{ensureReservable({...session,occupied});}
      catch(error){if(error instanceof BookingPolicyViolation)throw new BookingCapacityConflict(error.message);throw error;}
      if(previous){
        const at=new Date();
        await tx.classBooking.update({
          where:{id:previous.id},data:{status:'BOOKED',bookedAt:at,cancelledAt:null},
        });
        if(session.course?.requiresPackage){
          try{
            await reserveBookingCredit(tx,{
              workspaceId,userId,bookingId:previous.id,courseId:session.courseId!,startsAt:session.startsAt,
            });
          }catch(error){
            if(error instanceof PackageCreditRequired)throw new BookingCapacityConflict(error.message);
            throw error;
          }
        }
        await notifyUser(tx,{
          workspaceId,userId,sessionId,kind:'BOOKING_CONFIRMED',
          eventKey:'booking:'+previous.id+':'+at.toISOString(),
          ...bookingNotice(session.title),
        });
        return {id:previous.id,sessionId,status:'BOOKED' as const,alreadyBooked:false};
      }
      const created=await tx.classBooking.create({
        data:{workspaceId,sessionId,userId},select:{id:true,sessionId:true,bookedAt:true,status:true},
      });
      if(session.course?.requiresPackage){
        try{
          await reserveBookingCredit(tx,{
            workspaceId,userId,bookingId:created.id,courseId:session.courseId!,startsAt:session.startsAt,
          });
        }catch(error){
          if(error instanceof PackageCreditRequired)throw new BookingCapacityConflict(error.message);
          throw error;
        }
      }
      await notifyUser(tx,{
        workspaceId,userId,sessionId,kind:'BOOKING_CONFIRMED',
        eventKey:'booking:'+created.id+':'+created.bookedAt.toISOString(),
        ...bookingNotice(session.title),
      });
      return {id:created.id,sessionId:created.sessionId,status:'BOOKED' as const,alreadyBooked:false};
    });
  }
  async cancel(workspaceId:string,bookingId:string,userId:string){
    // Locate a candidate only to find the shared session-lock key.
    // Revalidate every property once the booking lock is held.
    const candidate=await prisma.classBooking.findFirst({
      where:{id:bookingId,workspaceId,userId},select:{sessionId:true},
    });
    if(!candidate)throw new BookingMissing();
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+candidate.sessionId}))::text AS lock_acquired`;
      const booking=await tx.classBooking.findFirst({
        where:{id:bookingId,workspaceId,userId,session:{workspaceId}},
        select:{id:true,status:true,session:{select:{startsAt:true}}},
      });
      if(!booking)throw new BookingMissing();
      // Preserve idempotence even if the session has already started.
      if(booking.status==='CANCELLED')return {id:booking.id,status:'CANCELLED' as const};
      try{ensureCancellable(booking.session.startsAt);}
      catch(error){
        if(error instanceof BookingPolicyViolation)throw new BookingCapacityConflict(error.message);
        throw error;
      }
      const updated=await tx.classBooking.updateMany({
        where:{id:booking.id,workspaceId,userId,status:'BOOKED'},
        data:{status:'CANCELLED',cancelledAt:new Date()},
      });
      if(updated.count!==1)throw new BookingCapacityConflict();
      // Credits are returned atomically with the student's cancellation.
      await refundBookingCredit(tx,booking.id);
      return {id:booking.id,status:'CANCELLED' as const};
    });
  }
}
