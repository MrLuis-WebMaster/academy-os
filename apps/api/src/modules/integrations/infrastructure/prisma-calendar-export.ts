import {prisma} from '../../../lib/prisma.js';
import type {CalendarExportRepository,CalendarExportSnapshot} from '../application/calendar-ports.js';
export class PrismaCalendarExport implements CalendarExportRepository{
 async snapshot(workspaceId:string,userId:string,sessionId:string){
  return prisma.$transaction(async tx=>{
   const roles=await tx.workspaceMember.findMany({where:{workspaceId,userId},select:{role:true}});
   const manager=roles.some(r=>r.role==='OWNER'||r.role==='ADMIN');
   if(!manager&&!roles.some(r=>r.role==='TEACHER'))return null;
   const lesson=await tx.classSession.findFirst({where:{id:sessionId,workspaceId,
    ...(manager?{}:{teacher:{is:{userId,workspaceId}}})},
    select:{id:true,title:true,startsAt:true,endsAt:true,timezone:true,status:true,mode:true,meetingUrl:true,provider:true}});
   if(!lesson)return null;
   const connection=await tx.externalConnection.findFirst({where:{workspaceId,userId,provider:'GOOGLE_CALENDAR',encryptedCredentials:{not:null}},
    select:{id:true,encryptedCredentials:true,connectedAt:true}});
   if(!connection?.encryptedCredentials)return null;
   return {connectionId:connection.id,connectedAt:connection.connectedAt,encryptedCredentials:connection.encryptedCredentials,lesson};
  });
 }
 async publishMeet(workspaceId:string,userId:string,snapshot:CalendarExportSnapshot,meetUrl:string){
  return prisma.$transaction(async tx=>{
   const lesson=snapshot.lesson;
   // Use the scheduling lock, followed by the OAuth connection lock.
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:booking:'+lesson.id}))::text`;
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['google-calendar',workspaceId,userId])},0))::text`;
   const roles=await tx.workspaceMember.findMany({where:{workspaceId,userId},select:{role:true}});
   const manager=roles.some(r=>r.role==='OWNER'||r.role==='ADMIN');
   if(!manager&&!roles.some(r=>r.role==='TEACHER'))return false;
   const connection=await tx.externalConnection.findFirst({where:{
    id:snapshot.connectionId,workspaceId,userId,provider:'GOOGLE_CALENDAR',
    connectedAt:snapshot.connectedAt,encryptedCredentials:{not:null},
   },select:{id:true}});
   if(!connection)return false;
   const result=await tx.classSession.updateMany({where:{
    id:lesson.id,workspaceId,status:'CONFIRMED',mode:{in:['ONLINE','HYBRID']},
    startsAt:lesson.startsAt,endsAt:{equals:lesson.endsAt,gt:new Date()},
    title:lesson.title,meetingUrl:lesson.meetingUrl,provider:lesson.provider,
    ...(manager?{}:{teacher:{is:{workspaceId,userId}}}),
   },data:{meetingUrl:meetUrl,provider:'GOOGLE_MEET'}});
   return result.count===1;
  });
 }
 async replaceCredential(workspaceId:string,userId:string,connectionId:string,oldValue:string,newValue:string){
  const updated=await prisma.externalConnection.updateMany({where:{id:connectionId,workspaceId,userId,provider:'GOOGLE_CALENDAR',encryptedCredentials:oldValue},
   data:{encryptedCredentials:newValue}});
  return updated.count===1;
 }
}
