import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {CurriculumRepository,TopicInput} from '../application/curriculum-ports.js';
import {
  CurriculumAccessDenied,CurriculumCourseMissing,CurriculumParentInvalid,
  CurriculumTeacherMissing,CurriculumTeacherNotAssigned,
} from '../application/curriculum-use-cases.js';

export class PrismaCurriculumRepository implements CurriculumRepository {
  private async scope(
    tx:Prisma.TransactionClient,workspaceId:string,actorId:string,courseId:string,managerOnly:boolean,
  ){
    const [members,course]=await Promise.all([
      tx.workspaceMember.findMany({
        where:{
          workspaceId,userId:actorId,
          role:{in:managerOnly?['OWNER','ADMIN']:['OWNER','ADMIN','TEACHER']},
        },select:{role:true},
      }),
      tx.course.findFirst({where:{id:courseId,workspaceId},select:{id:true}}),
    ]);
    if(!members.length)throw new CurriculumAccessDenied();
    if(!course)throw new CurriculumCourseMissing();
    const isManager=members.some(m=>m.role==='OWNER'||m.role==='ADMIN');
    if(!isManager){
      const assigned=await tx.courseTeacher.findFirst({
        where:{courseId,teacher:{workspaceId,userId:actorId}},select:{teacherId:true},
      });
      if(!assigned)throw new CurriculumTeacherNotAssigned();
    }
    return course;
  }

  async show(workspaceId:string,actorId:string,courseId:string){
    return prisma.$transaction(async tx=>{
      await this.scope(tx,workspaceId,actorId,courseId,false);
      const [topics,teachers]=await Promise.all([
        tx.topic.findMany({
          where:{courseId},select:{id:true,title:true,parentId:true,order:true},
          orderBy:[{order:'asc'},{title:'asc'}],
        }),
        tx.courseTeacher.findMany({
          where:{courseId,teacher:{workspaceId}},
          select:{teacherId:true,teacher:{select:{user:{select:{name:true}}}}},
        }),
      ]);
      return {courseId,topics,teachers};
    });
  }

  async assign(workspaceId:string,actorId:string,courseId:string,teacherId:string){
    return prisma.$transaction(async tx=>{
      await this.scope(tx,workspaceId,actorId,courseId,true);
      const teacher=await tx.teacherProfile.findFirst({
        where:{workspaceId,id:teacherId},select:{id:true},
      });
      if(!teacher)throw new CurriculumTeacherMissing();
      return tx.courseTeacher.upsert({
        where:{courseId_teacherId:{courseId,teacherId}},
        create:{courseId,teacherId},update:{},
        select:{teacherId:true,courseId:true},
      });
    });
  }

  async unassign(workspaceId:string,actorId:string,courseId:string,teacherId:string){
    return prisma.$transaction(async tx=>{
      await this.scope(tx,workspaceId,actorId,courseId,true);
      await tx.courseTeacher.deleteMany({
        where:{courseId,teacherId,teacher:{workspaceId}},
      });
      return {courseId,teacherId,assigned:false as const};
    });
  }

  async createTopic(workspaceId:string,actorId:string,courseId:string,input:TopicInput){
    return prisma.$transaction(async tx=>{
      await this.scope(tx,workspaceId,actorId,courseId,false);
      if(input.parentId&&!await tx.topic.findFirst({
        where:{id:input.parentId,courseId},select:{id:true},
      }))throw new CurriculumParentInvalid();
      return tx.topic.create({
        data:{courseId,title:input.title,order:input.order,parentId:input.parentId||null},
        select:{id:true,courseId:true,title:true,parentId:true,order:true},
      });
    });
  }
}
