import {prisma} from '../../../lib/prisma.js';
import type {ReflectionRepository} from '../application/reflection-ports.js';
import {
  ReflectionAccessDenied,ReflectionConflict,ReflectionNoCourse,
  ReflectionNotFound,ReflectionTeacherMismatch,
} from '../application/reflection-use-cases.js';

export class PrismaReflectionRepository implements ReflectionRepository {
  private async teachingAccess(
    tx:Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    workspaceId:string,userId:string,sessionId:string,
  ) {
    const [memberships,session]=await Promise.all([
      tx.workspaceMember.findMany({
        where:{workspaceId,userId,role:{in:['OWNER','ADMIN','TEACHER']}},
        select:{role:true},
      }),
      tx.classSession.findFirst({
        where:{workspaceId,id:sessionId},
        select:{id:true,teacherProfileId:true,courseId:true,teacher:{select:{userId:true}}},
      }),
    ]);
    if(!memberships.length)throw new ReflectionAccessDenied();
    if(!session)throw new ReflectionNotFound();
    if(!session.courseId)throw new ReflectionNoCourse();
    const isManager=memberships.some(m=>m.role==='OWNER'||m.role==='ADMIN');
    if(!isManager&&session.teacher?.userId!==userId)throw new ReflectionTeacherMismatch();
    return session;
  }

  async listStaff(workspaceId:string,userId:string) {
    const memberships=await prisma.workspaceMember.findMany({
      where:{workspaceId,userId,role:{in:['OWNER','ADMIN','TEACHER']}},select:{role:true},
    });
    if(!memberships.length)throw new ReflectionAccessDenied();
    const isManager=memberships.some(m=>m.role==='OWNER'||m.role==='ADMIN');
    return prisma.classReflection.findMany({
      where:{session:{workspaceId,...(!isManager?{teacher:{workspaceId,userId}}:{})}},
      select:{
        id:true,sessionId:true,status:true,notes:true,approvedAt:true,
        session:{select:{title:true,courseId:true}},
      },
      take:100,
    });
  }

  async listStudent(workspaceId:string,userId:string) {
    const student=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
    });
    if(!student)throw new ReflectionAccessDenied();
    return prisma.classReflection.findMany({
      where:{
        status:'PUBLISHED',
        session:{workspaceId,course:{workspaceId,enrollments:{some:{userId}}}},
      },
      select:{
        id:true,notes:true,approvedAt:true,
        session:{select:{id:true,courseId:true,title:true}},
      },
      orderBy:{approvedAt:'desc'},take:100,
    });
  }

  async save(workspaceId:string,userId:string,sessionId:string,notes:string) {
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:reflection:'+sessionId}))::text AS lock_acquired`;
      await this.teachingAccess(tx,workspaceId,userId,sessionId);
      const existing=await tx.classReflection.findUnique({
        where:{sessionId},select:{status:true},
      });
      if(existing?.status==='PUBLISHED'){
        throw new ReflectionConflict('This Class Alive note was already published');
      }
      return tx.classReflection.upsert({
        where:{sessionId},
        create:{sessionId,notes,status:'DRAFT'},
        update:{notes,status:'DRAFT'},
        select:{id:true,sessionId:true,status:true,notes:true},
      });
    });
  }

  async publish(workspaceId:string,userId:string,sessionId:string) {
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:reflection:'+sessionId}))::text AS lock_acquired`;
      await this.teachingAccess(tx,workspaceId,userId,sessionId);
      const updated=await tx.classReflection.updateMany({
        where:{sessionId,status:{in:['DRAFT','REVIEW']},notes:{not:''}},
        data:{status:'PUBLISHED',approvedAt:new Date()},
      });
      if(updated.count!==1)throw new ReflectionConflict();
      const published=await tx.classReflection.findUnique({
        where:{sessionId},select:{id:true,status:true,approvedAt:true},
      });
      if(!published)throw new ReflectionNotFound();
      return published;
    });
  }
}
