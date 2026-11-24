import {lockPlan,limitsFor,quotasEnabled} from '../../saas/infrastructure/plan-policy.js';
import {prisma} from '../../../lib/prisma.js';
import type {InvitationRole} from '../domain/invitation.js';
import {allowedInvitationRole} from '../domain/invitation.js';
import type {InvitationRepository} from '../application/invitation-ports.js';
import {
  InvitationAccessDenied,InvitationLimitReached,InvitationRoleDenied,
  InvitationUnavailable,InvitationWrongEmail,
} from '../application/invitation-use-cases.js';

const DAY=24*60*60*1000;
const WEEK=7*DAY;

export class PrismaInvitationRepository implements InvitationRepository {
  async issue(workspaceId:string,actorId:string,email:string,role:InvitationRole,hash:string,now:Date) {
    return prisma.$transaction(async tx=>{
      // Prevent concurrent requests from exceeding the workspace's 100/day cap.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:invite-workspace:'+workspaceId}))::text AS lock_acquired`;
      const [members,issuedToday]=await Promise.all([
        tx.workspaceMember.findMany({
          where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},
          select:{role:true},
        }),
        tx.workspaceInvitation.count({
          where:{workspaceId,createdAt:{gt:new Date(now.getTime()-DAY)}},
        }),
      ]);
      if(!members.length)throw new InvitationAccessDenied();
      if(role==='ADMIN'&&!members.some(m=>m.role==='OWNER'))throw new InvitationRoleDenied();
      if(issuedToday>=100)throw new InvitationLimitReached();
      const expiresAt=new Date(now.getTime()+WEEK);
      const record=await tx.workspaceInvitation.create({
        data:{workspaceId,email,role,tokenHash:hash,createdBy:actorId,expiresAt},
        select:{id:true,expiresAt:true},
      });
      return {id:record.id,expiresAt:record.expiresAt,email,role};
    });
  }

  async accept(hash:string,userId:string,email:string,now:Date) {
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:invite:'+hash}))::text AS lock_acquired`;
      const invitation=await tx.workspaceInvitation.findUnique({where:{tokenHash:hash}});
      if(!invitation||invitation.acceptedAt||invitation.expiresAt<=now)throw new InvitationUnavailable();
      if(invitation.email!==email)throw new InvitationWrongEmail();
      const role=allowedInvitationRole(invitation.role);
      const exists=await tx.workspaceMember.findFirst({
        where:{workspaceId:invitation.workspaceId,userId,role},select:{id:true},
      });
      await lockPlan(tx,invitation.workspaceId);
      if(quotasEnabled()){
        const limits=await limitsFor(tx,invitation.workspaceId);
        if(role==='STUDENT'&&!exists&&await tx.workspaceMember.count({where:{workspaceId:invitation.workspaceId,role:'STUDENT'}})>=limits.students)
          throw new InvitationLimitReached('Student limit for the academy plan reached');
        if(role==='TEACHER'&&!await tx.teacherProfile.findUnique({where:{workspaceId_userId:{workspaceId:invitation.workspaceId,userId}},select:{id:true}})&&await tx.teacherProfile.count({where:{workspaceId:invitation.workspaceId}})>=limits.teachers)
          throw new InvitationLimitReached('Teacher limit for the academy plan reached');
      }
      if(!exists){
        await tx.workspaceMember.create({data:{workspaceId:invitation.workspaceId,userId,role}});
      }
      if(role==='TEACHER'){
        await tx.teacherProfile.upsert({
          where:{workspaceId_userId:{workspaceId:invitation.workspaceId,userId}},
          create:{workspaceId:invitation.workspaceId,userId},update:{},
        });
      }
      await tx.workspaceInvitation.update({where:{id:invitation.id},data:{acceptedAt:now}});
      return {workspaceId:invitation.workspaceId,role};
    });
  }
}
