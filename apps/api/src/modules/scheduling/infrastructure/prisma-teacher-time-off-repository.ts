import {prisma} from '../../../lib/prisma.js';
import type {TeacherTimeOffRepository} from '../application/time-off-ports.js';
import type {TimeOffWindow} from '../domain/time-off.js';
import {TimeOffConflict,TimeOffTeacherUnknown} from '../application/manage-time-off-use-case.js';

export class PrismaTeacherTimeOffRepository implements TeacherTimeOffRepository {
 async teacherForUser(workspaceId:string,userId:string){
  return (await prisma.teacherProfile.findFirst({
   where:{workspaceId,userId},select:{id:true},
  }))?.id??null;
 }
 async belongsToWorkspace(workspaceId:string,teacherProfileId:string){
  return Boolean(await prisma.teacherProfile.findFirst({
   where:{id:teacherProfileId,workspaceId},select:{id:true},
  }));
 }
 async list(workspaceId:string,teacherProfileId?:string){
  return prisma.teacherTimeOff.findMany({
   where:{workspaceId,...(teacherProfileId?{teacherProfileId}:{})},
   select:{id:true,workspaceId:true,teacherProfileId:true,startsAt:true,endsAt:true,reason:true,createdAt:true},
   orderBy:{startsAt:'asc'},take:150,
  });
 }
 async create(workspaceId:string,teacherProfileId:string,actorId:string,window:TimeOffWindow){
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw\`SELECT pg_advisory_xact_lock(hashtext(\${'academy-os:teacher:'+teacherProfileId}))::text AS lock_acquired\`;
   const teacher=await tx.teacherProfile.findFirst({where:{id:teacherProfileId,workspaceId},select:{id:true}});
   if(!teacher)throw new TimeOffTeacherUnknown();
   const existing=await tx.teacherTimeOff.findFirst({
    where:{workspaceId,teacherProfileId,startsAt:{lt:window.endsAt},endsAt:{gt:window.startsAt}},
    select:{id:true},
   });
   if(existing)throw new TimeOffConflict('This absence overlaps another blocked period');
   const booked=await tx.classSession.findFirst({
    where:{workspaceId,teacherProfileId,status:'CONFIRMED',startsAt:{lt:window.endsAt},endsAt:{gt:window.startsAt}},
    select:{id:true},
   });
   if(booked)throw new TimeOffConflict('Reschedule existing classes before blocking this period');
   return tx.teacherTimeOff.create({
    data:{workspaceId,teacherProfileId,createdByUserId:actorId,...window},
    select:{id:true,workspaceId:true,teacherProfileId:true,startsAt:true,endsAt:true,reason:true,createdAt:true},
   });
  });
 }
 async remove(workspaceId:string,id:string,teacherProfileId?:string){
  const deleted=await prisma.teacherTimeOff.deleteMany({
   where:{id,workspaceId,...(teacherProfileId?{teacherProfileId}:{})},
  });
  return deleted.count===1;
 }
}
