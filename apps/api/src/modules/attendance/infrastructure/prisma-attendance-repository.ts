import {prisma} from '../../../lib/prisma.js';
import type {AttendanceRepository} from '../application/ports.js';
import type {AttendanceStatus} from '../domain/attendance-policy.js';
import {ensureMayMarkAttendance} from '../domain/attendance-policy.js';
import {
  ActiveAttendanceBookingNotFound,AttendanceAccessDenied,AttendanceChangedConflict,
} from '../application/attendance-use-cases.js';

export class PrismaAttendanceRepository implements AttendanceRepository {
  async listStaff(workspaceId:string,actorId:string,isManager:boolean) {
    return prisma.classBooking.findMany({
      where:{
        workspaceId,status:'BOOKED',
        ...(!isManager?{session:{workspaceId,teacher:{userId:actorId}}}:{}),
      },
      select:{
        id:true,sessionId:true,attendance:true,bookedAt:true,
        student:{select:{name:true}},session:{select:{title:true,startsAt:true}},
      },
      take:200,
    });
  }

  async mark(workspaceId:string,actorId:string,_isManager:boolean,bookingId:string,attendance:AttendanceStatus) {
    return prisma.$transaction(async tx=>{
      const candidate=await tx.classBooking.findFirst({
        where:{id:bookingId,workspaceId,status:'BOOKED'},select:{sessionId:true},
      });
      if(!candidate)throw new ActiveAttendanceBookingNotFound();

      // Coordinate with cancellation, bookings and other attendance changes on this class.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+candidate.sessionId}))::text AS lock_acquired`;

      // Recheck permissions and state in the transaction, even if they changed
      // between the application-level authorization and the actual write.
      const [membership,booking]=await Promise.all([
        tx.workspaceMember.findMany({
          where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
          select:{role:true},
        }),
        tx.classBooking.findFirst({
          where:{id:bookingId,workspaceId,status:'BOOKED'},
          select:{
            id:true,session:{
              select:{id:true,workspaceId:true,status:true,teacher:{select:{userId:true}}},
            },
          },
        }),
      ]);
      if(!membership.length)throw new AttendanceAccessDenied();
      if(!booking||booking.session.workspaceId!==workspaceId)throw new ActiveAttendanceBookingNotFound();
      const isManager=membership.some(member=>member.role==='OWNER'||member.role==='ADMIN');
      ensureMayMarkAttendance(booking.session.status,booking.session.teacher?.userId??null,actorId,isManager);

      const updated=await tx.classBooking.updateMany({
        where:{
          id:booking.id,workspaceId,status:'BOOKED',
          session:{workspaceId,status:{not:'CANCELLED'}},
        },
        data:{attendance},
      });
      if(updated.count!==1)throw new AttendanceChangedConflict();
      return {id:booking.id,attendance};
    });
  }
}
