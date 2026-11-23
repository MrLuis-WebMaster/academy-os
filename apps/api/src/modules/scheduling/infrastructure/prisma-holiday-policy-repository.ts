import {prisma} from '../../../lib/prisma.js';
import type {HolidayPolicyPatch,HolidayPolicyRepository} from '../application/holiday-policy-ports.js';
import {InvalidHolidaySettings} from '../domain/public-holidays.js';
import {HolidayPolicyAccessDenied,HolidayPolicyMissing} from '../application/holiday-policy-use-cases.js';

export class PrismaHolidayPolicyRepository implements HolidayPolicyRepository {
  async read(workspaceId:string,actorId:string){
    const access=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
      select:{id:true},
    });
    if(!access)throw new HolidayPolicyAccessDenied();
    const workspace=await prisma.workspace.findUnique({
      where:{id:workspaceId},
      select:{timezone:true,holidayCountry:true,avoidPublicHolidays:true},
    });
    if(!workspace)throw new HolidayPolicyMissing();
    return workspace;
  }

  async update(workspaceId:string,actorId:string,patch:HolidayPolicyPatch){
    return prisma.$transaction(async tx=>{
      const allowed=await tx.workspaceMember.findFirst({
        where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},
        select:{id:true},
      });
      if(!allowed)throw new HolidayPolicyAccessDenied();
      const original=await tx.workspace.findUnique({
        where:{id:workspaceId},
        select:{timezone:true,holidayCountry:true,avoidPublicHolidays:true},
      });
      if(!original)throw new HolidayPolicyMissing();
      const merged={...original,...patch};
      if(merged.avoidPublicHolidays&&merged.holidayCountry==='NONE'){
        throw new InvalidHolidaySettings('Choose a supported country before enabling automatic holiday blocking');
      }
      await tx.workspace.updateMany({where:{id:workspaceId},data:patch});
      return merged;
    });
  }
}
