import {prisma} from '../../../lib/prisma.js';
import type {CalendarReadRepository,CalendarScope} from '../application/ports.js';

export class PrismaCalendarReadRepository implements CalendarReadRepository {
 async memberships(workspaceId:string,userId:string){
  const rows=await prisma.workspaceMember.findMany({
   where:{workspaceId,userId},select:{role:true},
  });
  return rows.map(x=>x.role);
 }
 async lessons(workspaceId:string,userId:string,scope:CalendarScope){
  const now=new Date();
  const lower=new Date(now.getTime()-31*24*60*60*1000);
  const upper=new Date(now.getTime()+366*24*60*60*1000);
  const rows=await prisma.classSession.findMany({
   where:{
    workspaceId,status:{in:['CONFIRMED','CANCELLED']},
    startsAt:{gte:lower,lte:upper},
    ...(scope==='TEACHER'?{teacher:{workspaceId,userId}}:{}),
    ...(scope==='STUDENT'?{bookings:{some:{workspaceId,userId,status:'BOOKED'}}}:{}),
   },
   select:{
    id:true,title:true,startsAt:true,endsAt:true,status:true,location:true,meetingUrl:true,
    _count:{select:{changes:true}},
   },
   orderBy:{startsAt:'asc'},take:500,
  });
  return rows.map(x=>({
   id:x.id,title:x.title,startsAt:x.startsAt,endsAt:x.endsAt,
   status:x.status as 'CONFIRMED'|'CANCELLED',
   location:x.location,meetingUrl:x.meetingUrl,changes:x._count.changes,
  }));
 }
}
