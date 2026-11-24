import {prisma} from '../../../lib/prisma.js';
import type {StudentClassroomReadRepository} from '../application/student-classroom-read.js';
import {StudentClassroomAccessDenied} from '../application/student-classroom-read.js';

export class PrismaStudentClassroomRead implements StudentClassroomReadRepository {
  async forStudent(workspaceId:string,actorId:string){
    const member=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:'STUDENT'},select:{id:true},
    });
    if(!member)throw new StudentClassroomAccessDenied();
    const enrollments=await prisma.enrollment.findMany({
      where:{userId:actorId,course:{workspaceId}},
      select:{
        id:true,
        course:{select:{
          id:true,title:true,summary:true,requiresPackage:true,subject:{select:{name:true}},
          resources:{
            where:{workspaceId,published:true},
            select:{id:true,title:true,source:true,url:true},
          },
          sessions:{
            where:{status:'CONFIRMED',workspaceId},
            orderBy:{startsAt:'asc'},
            select:{
              id:true,title:true,startsAt:true,endsAt:true,seriesId:true,seriesIndex:true,
              mode:true,location:true,meetingUrl:true,
              bookings:{where:{workspaceId,userId:actorId,status:'BOOKED'},select:{id:true},take:1},
            },
          },
        }},
      },
      orderBy:{createdAt:'desc'},
    });
    // Keep unreserved sessions visible for booking, but never expose their join URLs.
    return enrollments.map(enrollment=>({...enrollment,course:{...enrollment.course,
      sessions:enrollment.course.sessions.map(({bookings,meetingUrl,...session})=>({
        ...session,meetingUrl:bookings.length&&session.mode!=='ONSITE'?meetingUrl:null,
      })),
    }}));
  }
}
