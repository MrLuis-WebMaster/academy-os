import {BadRequestException,Body,Controller,Get,NotFoundException,Param,Patch,Post,Req} from '@nestjs/common';
import {Public} from '../auth/public.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';
import {prisma} from '../lib/prisma.js';
import {requireMembership} from '../workspaces/access.js';
import {offeringInput,offeringVisibilityInput,studioSettingsInput} from './inputs.js';

@Controller('studio')
export class StudioController {
  @Public()
  @Get('public/:slug')
  async publicStore(@Param('slug') slug:string){
    const workspace=await prisma.workspace.findFirst({
      where:{slug,publicEnabled:true},
      select:{
        name:true,slug:true,description:true,brandColor:true,contactUrl:true,timezone:true,
        offerings:{
          where:{published:true},
          orderBy:{createdAt:'desc'},
          select:{id:true,title:true,description:true,priceCOP:true,durationMinutes:true,mode:true,course:{select:{title:true,subject:{select:{name:true}}}}},
        },
      },
    });
    if(!workspace)throw new NotFoundException('Academy storefront is not published');
    return workspace;
  }

  @Get('workspaces/:workspaceId')
  async config(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    const workspace=await prisma.workspace.findUnique({
      where:{id:workspaceId},
      select:{id:true,name:true,slug:true,description:true,contactUrl:true,publicEnabled:true,brandColor:true,timezone:true},
    });
    if(!workspace)throw new NotFoundException('Workspace does not exist');
    return workspace;
  }

  @Patch('workspaces/:workspaceId')
  async update(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    const parsed=studioSettingsInput.safeParse(input);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    return prisma.workspace.update({
      where:{id:workspaceId},data:{...parsed.data,contactUrl:parsed.data.contactUrl||null},
      select:{id:true,slug:true,name:true,description:true,contactUrl:true,publicEnabled:true},
    });
  }

  @Get('workspaces/:workspaceId/offerings')
  async offerings(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    return prisma.offering.findMany({
      where:{workspaceId},
      select:{id:true,title:true,description:true,priceCOP:true,durationMinutes:true,mode:true,published:true,courseId:true},
      orderBy:{createdAt:'desc'},take:150,
    });
  }

  @Post('workspaces/:workspaceId/offerings')
  async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    const parsed=offeringInput.safeParse(input);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    const {courseId,...data}=parsed.data;
    if(courseId){
      const course=await prisma.course.findFirst({where:{id:courseId,workspaceId},select:{id:true}});
      if(!course)throw new BadRequestException('Course does not belong to this workspace');
    }
    return prisma.offering.create({
      data:{workspaceId,...data,courseId:courseId||null,published:false},
      select:{id:true,title:true,priceCOP:true,published:true},
    });
  }

  @Patch('workspaces/:workspaceId/offerings/:offeringId')
  async setVisibility(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('offeringId') offeringId:string,@Body() input:unknown){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    const parsed=offeringVisibilityInput.safeParse(input);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    const result=await prisma.offering.updateMany({where:{id:offeringId,workspaceId},data:{published:parsed.data.published}});
    if(result.count!==1)throw new NotFoundException('Offering not found');
    return {id:offeringId,published:parsed.data.published};
  }
}
