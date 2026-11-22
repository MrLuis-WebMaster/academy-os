import {prisma} from '../../../lib/prisma.js';
import type {AvailabilityRepository} from '../application/availability-ports.js';
import type {WeeklySlotValue} from '../domain/weekly-availability.js';
import {AvailabilityConflict} from '../application/manage-availability-use-case.js';

export class PrismaAvailabilityRepository implements AvailabilityRepository {
  async teacherInWorkspace(workspaceId:string,teacherId:string){
    return Boolean(await prisma.teacherProfile.findFirst({where:{id:teacherId,workspaceId},select:{id:true}}));
  }
  async list(workspaceId:string){
    return prisma.weeklyAvailability.findMany({
      where:{workspaceId},select:{id:true,workspaceId:true,teacherProfileId:true,dayOfWeek:true,startMinute:true,endMinute:true},
      orderBy:[{dayOfWeek:'asc'},{startMinute:'asc'}],
    });
  }
  async add(workspaceId:string,teacherProfileId:string,slot:WeeklySlotValue){
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:teacher:'+teacherProfileId}))::text AS lock_acquired`;
      const count=await tx.weeklyAvailability.count({where:{workspaceId,teacherProfileId}});
      if(count>=28)throw new AvailabilityConflict('Maximum 28 weekly intervals per teacher');
      const overlap=await tx.weeklyAvailability.findFirst({
        where:{
          workspaceId,teacherProfileId,dayOfWeek:slot.dayOfWeek,
          startMinute:{lt:slot.endMinute},endMinute:{gt:slot.startMinute},
        },select:{id:true},
      });
      if(overlap)throw new AvailabilityConflict();
      return tx.weeklyAvailability.create({
        data:{workspaceId,teacherProfileId,...slot},
        select:{id:true,workspaceId:true,teacherProfileId:true,dayOfWeek:true,startMinute:true,endMinute:true},
      });
    });
  }
  async remove(workspaceId:string,id:string){
    const result=await prisma.weeklyAvailability.deleteMany({where:{id,workspaceId}});
    return result.count===1;
  }
}
