import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {ReminderPreferences} from '../domain/reminder-policy.js';
import type {ReminderPreferenceRepository} from '../application/reminder-ports.js';
import {ReminderPreferenceAccessDenied} from '../application/reminder-use-cases.js';

export class PrismaReminderPreferences implements ReminderPreferenceRepository {
  private async ensureStudent(tx:Prisma.TransactionClient,workspaceId:string,userId:string){
    if(!await tx.workspaceMember.findFirst({
      where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
    }))throw new ReminderPreferenceAccessDenied();
  }
  async read(workspaceId:string,userId:string){
    const membership=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
    });
    if(!membership)throw new ReminderPreferenceAccessDenied();
    const pref=await prisma.classReminderPreference.findUnique({
      where:{workspaceId_userId:{workspaceId,userId}},
      select:{remind24h:true,remind1h:true},
    });
    return pref??{remind24h:false,remind1h:false};
  }
  async save(workspaceId:string,userId:string,value:ReminderPreferences){
    return prisma.$transaction(async tx=>{
      await this.ensureStudent(tx,workspaceId,userId);
      return tx.classReminderPreference.upsert({
        where:{workspaceId_userId:{workspaceId,userId}},
        create:{workspaceId,userId,...value},
        update:value,
        select:{remind24h:true,remind1h:true},
      });
    });
  }
}
