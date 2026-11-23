import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {LearningAssetsRepository,LearningAssetView} from '../application/learning-assets-ports.js';
import type {LearningAssetDraft,LearningAssetKind} from '../domain/learning-asset.js';
import {
 parseLearningContent,parseLearningAssetRevision,
} from '../domain/learning-asset.js';
import {
 LearningAssetDenied,LearningAssetNotFound,LearningAssetConflict,
} from '../application/learning-assets-use-cases.js';

const fields={
 id:true,kind:true,title:true,content:true,publishedAt:true,
 reflection:{select:{
  sessionId:true,status:true,session:{select:{title:true,courseId:true}},
 }},
} as const;
function view(row:{
 id:string;kind:LearningAssetKind;title:string;content:unknown;
 publishedAt:Date|null;
 reflection:{sessionId:string;status:'DRAFT'|'REVIEW'|'PUBLISHED';
  session:{title:string;courseId:string|null}};
}):LearningAssetView{
 return {
  id:row.id,kind:row.kind,title:row.title,
  content:parseLearningContent(row.kind,row.content),publishedAt:row.publishedAt,
  reflection:row.reflection,
 };
}
export class PrismaLearningAssetsRepository implements LearningAssetsRepository{
 private async teachingScope(tx:Prisma.TransactionClient,workspaceId:string,actorId:string,sessionId:string){
  const [roles,session]=await Promise.all([
   tx.workspaceMember.findMany({
    where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
    select:{role:true},
   }),
   tx.classSession.findFirst({
    where:{workspaceId,id:sessionId,course:{workspaceId}},
    select:{
     id:true,teacher:{select:{userId:true}},
     reflection:{select:{id:true,status:true}},
    },
   }),
  ]);
  if(!roles.length)throw new LearningAssetDenied();
  if(!session||!session.reflection)throw new LearningAssetNotFound();
  const manager=roles.some(item=>item.role==='OWNER'||item.role==='ADMIN');
  if(!manager&&session.teacher?.userId!==actorId)throw new LearningAssetDenied();
  return session.reflection;
 }
 async create(workspaceId:string,actorId:string,input:LearningAssetDraft){
  return prisma.$transaction(async tx=>{
   const reflection=await this.teachingScope(tx,workspaceId,actorId,input.sessionId);
   const row=await tx.learningAsset.create({
    data:{
     reflectionId:reflection.id,createdByUserId:actorId,
     kind:input.kind,title:input.title,content:input.content as Prisma.InputJsonValue,
    },
    select:fields,
   });
   return view(row);
  });
 }
 async staff(workspaceId:string,actorId:string){
  const memberships=await prisma.workspaceMember.findMany({
   where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
   select:{role:true},
  });
  if(!memberships.length)throw new LearningAssetDenied();
  const manager=memberships.some(item=>item.role==='OWNER'||item.role==='ADMIN');
  const rows=await prisma.learningAsset.findMany({
   where:{
    reflection:{session:{workspaceId,course:{workspaceId},
     ...(!manager?{teacher:{workspaceId,userId:actorId}}:{})}},
   },
   select:fields,orderBy:{createdAt:'desc'},take:100,
  });
  return rows.map(view);
 }
 async revise(workspaceId:string,actorId:string,assetId:string,raw:unknown){
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:learning-asset:'+assetId}))::text AS lock_acquired`;
   const current=await tx.learningAsset.findFirst({
    where:{id:assetId,reflection:{session:{workspaceId,course:{workspaceId}}}},
    select:{id:true,publishedAt:true,kind:true,reflection:{select:{sessionId:true}}},
   });
   if(!current)throw new LearningAssetNotFound();
   await this.teachingScope(tx,workspaceId,actorId,current.reflection.sessionId);
   if(current.publishedAt)throw new LearningAssetConflict();
   const update=parseLearningAssetRevision(current.kind,raw);
   const count=await tx.learningAsset.updateMany({
    where:{id:assetId,publishedAt:null},data:{
     title:update.title,content:update.content as Prisma.InputJsonValue,
    },
   });
   if(count.count!==1)throw new LearningAssetConflict();
   return view(await tx.learningAsset.findUniqueOrThrow({where:{id:assetId},select:fields}));
  });
 }
 async publish(workspaceId:string,actorId:string,assetId:string){
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:learning-asset:'+assetId}))::text AS lock_acquired`;
   const current=await tx.learningAsset.findFirst({
    where:{id:assetId,reflection:{session:{workspaceId,course:{workspaceId}}}},
    select:{
     id:true,kind:true,content:true,publishedAt:true,
     reflection:{select:{sessionId:true,status:true}},
    },
   });
   if(!current)throw new LearningAssetNotFound();
   await this.teachingScope(tx,workspaceId,actorId,current.reflection.sessionId);
   if(current.reflection.status!=='PUBLISHED'){
    throw new LearningAssetConflict('Approve and publish the lesson reflection before publishing study resources');
   }
   parseLearningContent(current.kind,current.content);
   if(current.publishedAt){
    return view(await tx.learningAsset.findUniqueOrThrow({where:{id:assetId},select:fields}));
   }
   const updated=await tx.learningAsset.updateMany({
    where:{id:assetId,publishedAt:null},data:{publishedAt:new Date()},
   });
   if(updated.count!==1)throw new LearningAssetConflict();
   return view(await tx.learningAsset.findUniqueOrThrow({where:{id:assetId},select:fields}));
  });
 }
 async student(workspaceId:string,actorId:string){
  if(!await prisma.workspaceMember.findFirst({
   where:{workspaceId,userId:actorId,role:'STUDENT'},select:{id:true},
  }))throw new LearningAssetDenied();
  const rows=await prisma.learningAsset.findMany({
   where:{
    publishedAt:{not:null},
    reflection:{status:'PUBLISHED',session:{
     workspaceId,course:{workspaceId,enrollments:{some:{userId:actorId}}},
    }},
   },
   select:fields,orderBy:{publishedAt:'desc'},take:100,
  });
  return rows.map(view);
 }
}
