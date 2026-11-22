import {prisma} from '../../../lib/prisma.js';
import type {AiPracticeRepository,TeacherNoteSnapshot} from '../application/ports.js';
import type {PracticeSuggestion} from '../domain/suggestion.js';
import {AiQuotaReached} from '../application/suggest-practice-use-case.js';

const DAILY_LIMIT=10;
export class PrismaAiPracticeRepository implements AiPracticeRepository {
  async isAssignedTeacher(workspaceId:string,userId:string,sessionId:string){
    return Boolean(await prisma.classSession.findFirst({
      where:{id:sessionId,workspaceId,teacher:{workspaceId,userId}},select:{id:true},
    }));
  }
  async getTeacherNotes(workspaceId:string,sessionId:string):Promise<TeacherNoteSnapshot|null>{
    const reflection=await prisma.classReflection.findFirst({
      where:{sessionId,session:{workspaceId,courseId:{not:null}}},
      select:{id:true,notes:true,session:{select:{title:true,course:{select:{subject:{select:{name:true}}}}}}},
    });
    return reflection?{
      reflectionId:reflection.id,notes:reflection.notes,sessionTitle:reflection.session.title,
      subjectName:reflection.session.course?.subject?.name??'General',
    }:null;
  }
  async reserveDailyAttempt(workspaceId:string,userId:string,sessionId:string,model:string){
    return prisma.$transaction(async tx=>{
      const today=new Date();
      const dayStart=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:ai:'+workspaceId+':'+dayStart.toISOString()}))::text AS lock_acquired`;
      const used=await tx.aiGeneration.count({where:{workspaceId,createdAt:{gte:dayStart}}});
      if(used>=DAILY_LIMIT)throw new AiQuotaReached();
      const generation=await tx.aiGeneration.create({
        data:{workspaceId,actorUserId:userId,sessionId,model,status:'PENDING'},
        select:{id:true},
      });
      return generation.id;
    });
  }
  async completeAttempt(id:string,generated:{title:string;questions:PracticeSuggestion['questions']},reflectionId:string){
    return prisma.$transaction(async tx=>{
      const activity=await tx.activity.create({
        data:{reflectionId,title:generated.title,questions:generated.questions},
        select:{id:true,title:true,publishedAt:true},
      });
      await tx.aiGeneration.update({where:{id},data:{status:'COMPLETED',activityId:activity.id}});
      return {id:activity.id,title:activity.title,publishedAt:null};
    });
  }
  async failAttempt(id:string){
    await prisma.aiGeneration.updateMany({where:{id,status:'PENDING'},data:{status:'FAILED'}});
  }
}
