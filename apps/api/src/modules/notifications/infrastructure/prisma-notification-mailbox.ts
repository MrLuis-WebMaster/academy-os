import {prisma} from '../../../lib/prisma.js';
import type {NotificationMailboxRepository} from '../application/ports.js';

export class PrismaNotificationMailbox implements NotificationMailboxRepository {
 async list(workspaceId:string,userId:string) {
  const [items,unreadCount]=await Promise.all([
   prisma.notification.findMany({
    where:{workspaceId,userId},
    select:{id:true,kind:true,title:true,body:true,sessionId:true,createdAt:true,readAt:true},
    orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,
   }),
   prisma.notification.count({where:{workspaceId,userId,readAt:null}}),
  ]);
  return {items,unreadCount};
 }
 async read(workspaceId:string,userId:string,id:string) {
  const updated=await prisma.notification.updateMany({
   where:{id,workspaceId,userId,readAt:null},data:{readAt:new Date()},
  });
  return updated.count>0 || Boolean(await prisma.notification.findFirst({
   where:{id,workspaceId,userId},select:{id:true},
  }));
 }
 async readAll(workspaceId:string,userId:string){
  const updated=await prisma.notification.updateMany({
   where:{workspaceId,userId,readAt:null},data:{readAt:new Date()},
  });
  return updated.count;
 }
}
