import {prisma} from '../../../lib/prisma.js';
import {PrismaAiPracticeRepository} from './prisma-ai-practice-repository.js';
import type {StudentTutoringRepository} from '../application/tutor-ports.js';
import type {CourseEvidence} from '../domain/tutor-answer.js';

export class PrismaStudentTutorRepository implements StudentTutoringRepository {
  private readonly quota=new PrismaAiPracticeRepository();
  async enrolled(workspaceId:string,userId:string,courseId:string){
    return Boolean(await prisma.enrollment.findFirst({
      where:{userId,courseId,course:{workspaceId}},select:{id:true},
    }));
  }
  async publishedEvidence(workspaceId:string,courseId:string):Promise<CourseEvidence[]>{
    const notes=await prisma.classReflection.findMany({
      where:{status:'PUBLISHED',session:{workspaceId,courseId}},
      select:{sessionId:true,notes:true,session:{select:{title:true}}},
      orderBy:{approvedAt:'desc'},take:6,
    });
    return notes.map(x=>({id:x.sessionId,title:x.session.title,notes:x.notes}));
  }
  async reserveDailyAttempt(workspaceId:string,userId:string,sessionId:string,model:string){
    return this.quota.reserveDailyAttempt(workspaceId,userId,sessionId,model);
  }
  async finishAttempt(id:string){
    await prisma.aiGeneration.updateMany({where:{id,status:'PENDING'},data:{status:'COMPLETED'}});
  }
  async failAttempt(id:string){await this.quota.failAttempt(id);}
}
