import {prisma} from '../../../lib/prisma.js';
import {CourseNotFound,CoursePolicyConflict} from '../application/course-use-cases.js';
import {SubjectAccessDenied} from '../application/subject-use-cases.js';
import type {CourseDraft} from '../domain/course-draft.js';
import type {CourseRepository,CourseListItem,CourseCreated} from '../application/course-ports.js';

export class PrismaCourseRepository implements CourseRepository {
  async listByWorkspace(workspaceId:string):Promise<CourseListItem[]>{
    return prisma.course.findMany({
      where:{workspaceId},
      select:{id:true,title:true,summary:true,published:true,requiresPackage:true,subjectId:true,subject:{select:{id:true,name:true}}},
      orderBy:{title:'asc'},
    });
  }
  async setPackageRequirement(workspaceId:string,actorId:string,courseId:string,required:boolean){
    return prisma.$transaction(async tx=>{
      // The policy lock is shared with every individual and recurring booking.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:course-policy:'+courseId}))::text AS lock_acquired`;
      const member=await tx.workspaceMember.findFirst({
        where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},select:{id:true},
      });
      if(!member)throw new SubjectAccessDenied();
      const course=await tx.course.findFirst({
        where:{id:courseId,workspaceId},select:{id:true,requiresPackage:true},
      });
      if(!course)throw new CourseNotFound();
      if(required&&!course.requiresPackage){
        const uncredited=await tx.classBooking.findFirst({
          where:{
            workspaceId,status:'BOOKED',
            session:{courseId,workspaceId,status:'CONFIRMED',startsAt:{gt:new Date()}},
            OR:[{packageRedemption:{is:null}},{packageRedemption:{is:{refundedAt:{not:null}}}}],
          },select:{id:true},
        });
        if(uncredited)throw new CoursePolicyConflict();
      }
      const updated=await tx.course.update({
        where:{id:courseId},data:{requiresPackage:required},
        select:{id:true,requiresPackage:true},
      });
      return updated;
    });
  }
    async subjectExists(workspaceId:string,subjectId:string):Promise<boolean>{
    const row=await prisma.subject.findFirst({where:{id:subjectId,workspaceId},select:{id:true}});
    return Boolean(row);
  }
  async create(workspaceId:string,draft:CourseDraft):Promise<CourseCreated>{
    return prisma.course.create({
      data:{workspaceId,title:draft.title,summary:draft.summary,subjectId:draft.subjectId},
      select:{id:true,title:true,summary:true,subjectId:true},
    });
  }
}
