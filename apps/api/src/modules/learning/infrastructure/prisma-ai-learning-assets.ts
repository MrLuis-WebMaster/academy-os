import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {LearningAssetDraft} from '../domain/learning-asset.js';
import type {AiLearningAssetsRepository} from '../application/ai-learning-asset-ports.js';
import {PrismaAiPracticeRepository} from './prisma-ai-practice-repository.js';
import {LearningAssetNotFound} from '../application/learning-assets-use-cases.js';

export class PrismaAiLearningAssetsRepository implements AiLearningAssetsRepository{
 private readonly quota=new PrismaAiPracticeRepository();
 isAssignedTeacher(workspaceId:string,actorId:string,sessionId:string){
  return this.quota.isAssignedTeacher(workspaceId,actorId,sessionId);
 }
 teacherNotes(workspaceId:string,sessionId:string){
  return this.quota.getTeacherNotes(workspaceId,sessionId);
 }
 reserveDailyAttempt(workspaceId:string,actorId:string,sessionId:string,model:string){
  return this.quota.reserveDailyAttempt(workspaceId,actorId,sessionId,model);
 }
 failAttempt(id:string){return this.quota.failAttempt(id);}
 async completeDraft(workspaceId:string,actorId:string,sessionId:string,
  generationId:string,reflectionId:string,draft:LearningAssetDraft){
  return prisma.$transaction(async tx=>{
   const [generation,reflection]=await Promise.all([
    tx.aiGeneration.findFirst({
     where:{
      id:generationId,workspaceId,actorUserId:actorId,sessionId,status:'PENDING',
     },select:{id:true},
    }),
    tx.classReflection.findFirst({
     where:{id:reflectionId,sessionId,session:{workspaceId,courseId:{not:null}}},
     select:{id:true},
    }),
   ]);
   if(!generation||!reflection)throw new LearningAssetNotFound();
   const state=await tx.aiGeneration.updateMany({
    where:{id:generationId,workspaceId,status:'PENDING'},data:{status:'COMPLETED'},
   });
   if(state.count!==1)throw new LearningAssetNotFound();
   const created=await tx.learningAsset.create({
    data:{
     reflectionId,createdByUserId:actorId,kind:draft.kind,
     title:draft.title,content:draft.content as Prisma.InputJsonValue,
    },
    select:{id:true,title:true,kind:true,publishedAt:true},
   });
   return {id:created.id,title:created.title,kind:created.kind,publishedAt:null};
  });
 }
}
