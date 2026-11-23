import {prisma} from '../../../lib/prisma.js';
import {notifyUser} from '../../notifications/infrastructure/personal-notice-publisher.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {SosReferralInput,SosResolution} from '../domain/sos-referral.js';
import type {SosReferralRepository} from '../application/sos-referral-ports.js';
import {SosReferralDenied,SosReferralNotFound,SosReferralLimitReached} from '../application/sos-referral-use-cases.js';

const selectFields={
 id:true,courseId:true,studentUserId:true,question:true,status:true,
 reply:true,createdAt:true,resolvedAt:true,course:{select:{title:true}},
} as const;
export class PrismaSosReferralRepository implements SosReferralRepository{
 private async role(tx:Prisma.TransactionClient,workspaceId:string,userId:string,student:boolean){
  return tx.workspaceMember.findMany({
   where:{workspaceId,userId,role:{in:student?['STUDENT']:['OWNER','ADMIN','TEACHER']}},
   select:{role:true},
  });
 }
 private async teachingAccess(tx:Prisma.TransactionClient,workspaceId:string,actorId:string,courseId:string){
  const roles=await this.role(tx,workspaceId,actorId,false);
  if(!roles.length)throw new SosReferralDenied();
  if(!roles.some(r=>r.role==='OWNER'||r.role==='ADMIN')){
   const assigned=await tx.courseTeacher.findFirst({
    where:{courseId,course:{workspaceId},teacher:{workspaceId,userId:actorId}},
    select:{teacherId:true},
   });
   if(!assigned)throw new SosReferralDenied();
  }
 }
 async send(workspaceId:string,userId:string,input:SosReferralInput){
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:sos-student:'+workspaceId+':'+input.courseId+':'+userId}))::text AS lock_acquired`;
   if(!(await this.role(tx,workspaceId,userId,true)).length)throw new SosReferralDenied();
   const enrollment=await tx.enrollment.findFirst({
    where:{courseId:input.courseId,userId,course:{workspaceId}},select:{id:true},
   });
   if(!enrollment)throw new SosReferralDenied();
   const unanswered=await tx.sosReferral.count({
    where:{workspaceId,courseId:input.courseId,studentUserId:userId,status:'OPEN'},
   });
   if(unanswered>=3)throw new SosReferralLimitReached();
   const referral=await tx.sosReferral.create({
    data:{workspaceId,courseId:input.courseId,studentUserId:userId,question:input.question},
    select:selectFields,
   });
   const assignments=await tx.courseTeacher.findMany({
    where:{courseId:input.courseId,course:{workspaceId}},
    select:{teacher:{select:{userId:true}}},
   });
   const teacherIds=[...new Set(assignments.map(x=>x.teacher.userId))];
   const members=await tx.workspaceMember.findMany({
    where:{workspaceId,userId:{in:teacherIds},role:{in:['OWNER','ADMIN','TEACHER']}},
    select:{userId:true},
   });
   for(const recipient of members){
    await notifyUser(tx,{
     workspaceId,userId:recipient.userId,kind:'SOS_REQUEST',
     eventKey:'sos-request:'+referral.id,title:'Un alumno necesita ayuda',
     body:'Hay una duda pendiente en "'+referral.course.title.slice(0,110)+'". Revísala en la bandeja de Profe SOS.',
    });
   }
   return referral;
  });
 }
 async mine(workspaceId:string,userId:string){
  if(!(await prisma.workspaceMember.findFirst({
   where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
  })))throw new SosReferralDenied();
  return prisma.sosReferral.findMany({
   where:{
    workspaceId,studentUserId:userId,
    course:{workspaceId,enrollments:{some:{userId}}},
   },
   select:selectFields,orderBy:{createdAt:'desc'},take:100,
  });
 }
 async staff(workspaceId:string,userId:string){
  const roles=await prisma.workspaceMember.findMany({
   where:{workspaceId,userId,role:{in:['OWNER','ADMIN','TEACHER']}},select:{role:true},
  });
  if(!roles.length)throw new SosReferralDenied();
  const manager=roles.some(r=>r.role==='OWNER'||r.role==='ADMIN');
  return prisma.sosReferral.findMany({
   where:{
    workspaceId,
    ...(!manager?{course:{workspaceId,teachers:{some:{teacher:{workspaceId,userId}}}}}:{}),
   },
   select:{...selectFields,student:{select:{name:true}}},
   orderBy:{createdAt:'desc'},take:100,
  });
 }
 async resolve(workspaceId:string,userId:string,id:string,input:SosResolution){
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:sos-referral:'+id}))::text AS lock_acquired`;
   const current=await tx.sosReferral.findFirst({
    where:{workspaceId,id},select:selectFields,
   });
   if(!current)throw new SosReferralNotFound();
   await this.teachingAccess(tx,workspaceId,userId,current.courseId);
   if(current.status==='RESOLVED')return current;
   const updated=await tx.sosReferral.update({
    where:{id},
    data:{status:'RESOLVED',reply:input.reply,resolvedAt:new Date(),resolvedByUserId:userId},
    select:selectFields,
   });
   const student=await tx.workspaceMember.findFirst({
    where:{workspaceId,userId:updated.studentUserId,role:'STUDENT'},select:{id:true},
   });
   if(student){
    await notifyUser(tx,{
     workspaceId,userId:updated.studentUserId,kind:'SOS_ANSWERED',
     eventKey:'sos-answered:'+id,title:'Tu profesor respondió una duda',
     body:'Hay una respuesta en "'+updated.course.title.slice(0,110)+'". Ábrela en Profe SOS.',
    });
   }
   return updated;
  });
 }
}
