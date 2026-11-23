import {
  BadRequestException,Body,Controller,ForbiddenException,Get,
  HttpException,InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import {Public} from '../../../auth/public.js';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidStudioInput} from '../domain/studio.js';
import {
  StudioAccessDenied,StudioCourseInvalid,StudioOfferingMissing,StudioUnavailable,StudioUseCases,
} from '../application/studio-use-cases.js';

@Controller('studio')
export class StudioController {
  constructor(private readonly studio:StudioUseCases){}
  private fail(error:unknown):never{
    if(error instanceof InvalidStudioInput||error instanceof StudioCourseInvalid){
      throw new BadRequestException(error.message);
    }
    if(error instanceof StudioAccessDenied)throw new ForbiddenException(error.message);
    if(error instanceof StudioUnavailable||error instanceof StudioOfferingMissing){
      throw new NotFoundException(error.message);
    }
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage Profe Studio');
  }
  @Public()
  @Get('public/:slug')
  async publicStore(@Param('slug') slug:string){
    try{return await this.studio.publicStore(slug);}
    catch(error){return this.fail(error);}
  }
  @Get('workspaces/:workspaceId')
  async config(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.studio.config(workspaceId,req.academyUser!.id);}
    catch(error){return this.fail(error);}
  }
  @Patch('workspaces/:workspaceId')
  async update(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() raw:unknown){
    try{return await this.studio.update(workspaceId,req.academyUser!.id,raw);}
    catch(error){return this.fail(error);}
  }
  @Get('workspaces/:workspaceId/offerings')
  async offerings(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.studio.offerings(workspaceId,req.academyUser!.id);}
    catch(error){return this.fail(error);}
  }
  @Post('workspaces/:workspaceId/offerings')
  async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() raw:unknown){
    try{return await this.studio.create(workspaceId,req.academyUser!.id,raw);}
    catch(error){return this.fail(error);}
  }
  @Patch('workspaces/:workspaceId/offerings/:offeringId')
  async setVisibility(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('offeringId') offeringId:string,@Body() raw:unknown){
    try{return await this.studio.setPublished(workspaceId,req.academyUser!.id,offeringId,raw);}
    catch(error){return this.fail(error);}
  }
}
