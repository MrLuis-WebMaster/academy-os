import {prisma} from '../../../lib/prisma.js';
import type {StudentBookingHistoryRepository} from '../application/student-booking-history.js';
import {BookingHistoryAccessDenied} from '../application/student-booking-history.js';

/** Never accept userId from HTTP query parameters; only the authenticated principal. */
export class PrismaStudentBookingHistory implements StudentBookingHistoryRepository {
  async mine(workspaceId:string,actorId:string){
    const member=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:'STUDENT'},select:{id:true},
    });
    if(!member)throw new BookingHistoryAccessDenied();
    return prisma.classBooking.findMany({
      where:{workspaceId,userId:actorId,session:{workspaceId}},
      select:{
        id:true,status:true,sessionId:true,bookedAt:true,
        session:{select:{
          title:true,startsAt:true,mode:true,location:true,status:true,courseId:true,
          changes:{
            orderBy:{changedAt:'desc'},take:3,
            select:{
              id:true,changedAt:true,reason:true,oldStartsAt:true,newStartsAt:true,
            },
          },
        }},
      },
      orderBy:{bookedAt:'desc'},
    });
  }
}
