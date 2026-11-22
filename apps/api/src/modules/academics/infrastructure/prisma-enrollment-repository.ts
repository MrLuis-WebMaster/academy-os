import {prisma} from '../../../lib/prisma.js';
import type {EnrollmentRepository} from '../application/enrollment-ports.js';
import {EnrollmentExists} from '../application/enrollment-use-cases.js';

export class PrismaEnrollmentRepository implements EnrollmentRepository {
  async courseExists(workspaceId:string,courseId:string) {
    return Boolean(await prisma.course.findFirst({where:{id:courseId,workspaceId},select:{id:true}}));
  }
  async studentIsMember(workspaceId:string,userId:string) {
    return Boolean(await prisma.workspaceMember.findFirst({where:{workspaceId,userId,role:'STUDENT'},select:{id:true}}));
  }
  async add(courseId:string,userId:string) {
    try {
      return await prisma.enrollment.create({
        data:{courseId,userId},select:{id:true,courseId:true,userId:true,createdAt:true},
      });
    } catch(error) {
      if (error && typeof error==='object' && 'code' in error && error.code==='P2002') throw new EnrollmentExists();
      throw error;
    }
  }
  async remove(workspaceId:string,courseId:string,userId:string) {
    return prisma.$transaction(async tx=>{
      // Keep prior attendance/history while releasing future reserved seats.
      // A single DB transaction guarantees no partial unenrolment.
      const removed=await tx.enrollment.deleteMany({where:{courseId,userId,course:{workspaceId}}});
      if (!removed.count) return false;
      await tx.classBooking.updateMany({
        where:{workspaceId,userId,status:'BOOKED',session:{courseId,workspaceId,startsAt:{gt:new Date()}}},
        data:{status:'CANCELLED',cancelledAt:new Date()},
      });
      return true;
    });
  }
}
