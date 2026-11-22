import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { prisma } from '../lib/prisma.js';
import { requireMembership } from './access.js';

export const externalResourceInput=z.object({
  courseId:z.string().min(1),
  title:z.string().trim().min(3).max(140),
  url:z.url().max(2048).refine(value=>value.startsWith('https://'), 'Only HTTPS links are allowed'),
  published:z.boolean().default(false),
});

@Controller('workspaces/:workspaceId/materials')
export class MaterialsController {
  @Get()
  async list(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    await requireMembership(workspaceId,request.academyUser!.id,['OWNER','ADMIN']);
    return prisma.resource.findMany({
      where:{workspaceId},
      select:{id:true,title:true,url:true,courseId:true,published:true,source:true,aiAuthorized:true},
      orderBy:{title:'asc'},take:150,
    });
  }

  @Post()
  async create(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
    await requireMembership(workspaceId,request.academyUser!.id,['OWNER','ADMIN']);
    const parsed=externalResourceInput.safeParse(input);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    const course=await prisma.course.findFirst({where:{id:parsed.data.courseId,workspaceId}});
    if(!course)throw new BadRequestException('Course does not belong to this academy');
    return prisma.resource.create({
      data:{
        workspaceId,courseId:course.id,title:parsed.data.title,
        url:parsed.data.url,source:'EXTERNAL_URL',
        published:parsed.data.published,
        aiAuthorized:false,
      },
      select:{id:true,title:true,url:true,courseId:true,published:true},
    });
  }
}
