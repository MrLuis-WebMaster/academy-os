import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {TeacherMethodologyRepository} from '../application/methodology-ports.js';
import {defaultTeachingMethodology} from '../domain/teaching-methodology.js';
import type {TeachingMethodology} from '../domain/teaching-methodology.js';
import {MethodologyAccessDenied,MethodologyNotFound} from '../application/methodology-use-cases.js';

export class PrismaMethodologyRepository implements TeacherMethodologyRepository {
 private async authorize(tx:Prisma.TransactionClient,workspaceId:string,actorId:string,profileId:string){
  const [teacher,roles]=await Promise.all([
   tx.teacherProfile.findFirst({
    where:{id:profileId,workspaceId},
    select:{id:true,userId:true},
   }),
   tx.workspaceMember.findMany({
    where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
    select:{role:true},
   }),
  ]);
  if(!teacher)throw new MethodologyNotFound();
  const manager=roles.some(item=>item.role==='OWNER'||item.role==='ADMIN');
  if(!manager&&(!roles.length||teacher.userId!==actorId))throw new MethodologyAccessDenied();
 }
 async read(workspaceId:string,actorId:string,profileId:string):Promise<TeachingMethodology>{
  await prisma.$transaction(tx=>this.authorize(tx,workspaceId,actorId,profileId));
  const method=await prisma.teachingMethodology.findFirst({
   where:{workspaceId,teacherProfileId:profileId},
   select:{specialty:true,style:true,language:true,guidance:true,sosEnabled:true},
  });
  return method??{...defaultTeachingMethodology};
 }
 async save(workspaceId:string,actorId:string,profileId:string,value:TeachingMethodology){
  return prisma.$transaction(async tx=>{
   await this.authorize(tx,workspaceId,actorId,profileId);
   return tx.teachingMethodology.upsert({
    where:{teacherProfileId:profileId},
    create:{workspaceId,teacherProfileId:profileId,...value},
    update:value,
    select:{specialty:true,style:true,language:true,guidance:true,sosEnabled:true},
   });
  });
 }
}
