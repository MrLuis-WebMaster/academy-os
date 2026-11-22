import { BadRequestException, Body, Controller, ForbiddenException, GoneException, HttpException, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { requireMembership } from './access.js';

const inputSchema=z.object({email:z.email().max(255),role:z.enum(['TEACHER','STUDENT','ADMIN'])});
const tokenSchema=z.object({token:z.string().trim().min(40).max(100)});
function digest(token:string){return createHash('sha256').update(token).digest('hex');}

@Controller()
export class InvitationsController {
  @Post('workspaces/:workspaceId/invitations')
  async invite(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() body:unknown) {
    const userId=request.academyUser!.id;
    await requireMembership(workspaceId,userId,['OWNER','ADMIN']);
    const parsed=inputSchema.safeParse(body);if(!parsed.success)throw new BadRequestException('Invalid invitation');
    if(parsed.data.role==='ADMIN')await requireMembership(workspaceId,userId,['OWNER']);
    const email=parsed.data.email.trim().toLowerCase();
    const existing=await prisma.workspaceInvitation.count({where:{workspaceId,createdAt:{gt:new Date(Date.now()-24*60*60*1000)}}});
    if(existing>=100)throw new HttpException('Daily invitation limit reached', HttpStatus.TOO_MANY_REQUESTS);
    const token=randomBytes(32).toString('base64url');
    const record=await prisma.workspaceInvitation.create({data:{workspaceId,email,role:parsed.data.role,tokenHash:digest(token),createdBy:userId,expiresAt:new Date(Date.now()+7*24*60*60*1000)},select:{id:true,role:true,email:true,expiresAt:true}});
    return {...record,inviteUrl:`${process.env.WEB_ORIGIN||'http://localhost:5173'}/?invite=${encodeURIComponent(token)}`};
  }

  @Post('invitations/accept')
  async accept(@Req() request:AuthenticatedRequest,@Body() body:unknown) {
    const parsed=tokenSchema.safeParse(body);if(!parsed.success)throw new BadRequestException('Invalid invitation token');
    const tokenHash=digest(parsed.data.token);
    const userId=request.academyUser!.id;
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`academy-os:invite:${tokenHash}`}))`;
      const invitation=await tx.workspaceInvitation.findUnique({where:{tokenHash}});
      if(!invitation||invitation.acceptedAt||invitation.expiresAt<=new Date())throw new GoneException('Invitation expired or already used');
      if(invitation.email!==request.academyUser!.email.toLowerCase())throw new ForbiddenException('Sign in using the invited email address');
      const record=await tx.workspaceMember.findFirst({where:{workspaceId:invitation.workspaceId,userId,role:invitation.role}});
      if(!record)await tx.workspaceMember.create({data:{workspaceId:invitation.workspaceId,userId,role:invitation.role}});
      if(invitation.role==='TEACHER')await tx.teacherProfile.upsert({where:{workspaceId_userId:{workspaceId:invitation.workspaceId,userId}},create:{workspaceId:invitation.workspaceId,userId},update:{}});
      await tx.workspaceInvitation.update({where:{id:invitation.id},data:{acceptedAt:new Date()}});
      return {workspaceId:invitation.workspaceId,role:invitation.role};
    });
  }
}
