import {prisma} from '../../../lib/prisma.js';
import type {CalendarExportRepository} from '../application/calendar-ports.js';
export class PrismaCalendarExport implements CalendarExportRepository{
 async snapshot(workspaceId:string,userId:string,sessionId:string){
  return prisma.$transaction(async tx=>{
   const roles=await tx.workspaceMember.findMany({where:{workspaceId,userId},select:{role:true}});
   const manager=roles.some(r=>r.role==='OWNER'||r.role==='ADMIN');
   if(!manager&&!roles.some(r=>r.role==='TEACHER'))return null;
   const lesson=await tx.classSession.findFirst({where:{id:sessionId,workspaceId,
    ...(manager?{}:{teacher:{is:{userId,workspaceId}}})},
    select:{id:true,title:true,startsAt:true,endsAt:true,timezone:true,status:true,mode:true}});
   if(!lesson)return null;
   const connection=await tx.externalConnection.findFirst({where:{workspaceId,userId,provider:'GOOGLE_CALENDAR',encryptedCredentials:{not:null}},
    select:{id:true,encryptedCredentials:true}});
   if(!connection?.encryptedCredentials)return null;
   return {connectionId:connection.id,encryptedCredentials:connection.encryptedCredentials,lesson};
  });
 }
 async replaceCredential(workspaceId:string,userId:string,connectionId:string,oldValue:string,newValue:string){
  const updated=await prisma.externalConnection.updateMany({where:{id:connectionId,workspaceId,userId,provider:'GOOGLE_CALENDAR',encryptedCredentials:oldValue},
   data:{encryptedCredentials:newValue}});
  return updated.count===1;
 }
}
