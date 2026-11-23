import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,
  Get,HttpException,InternalServerErrorException,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidWorkspaceProvisioning} from '../domain/workspace-provisioning.js';
import {
  WorkspaceCreationFailed,WorkspaceLoginRequired,WorkspaceProvisionUseCases,WorkspaceSlugTaken,
} from '../application/workspace-provision-use-cases.js';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaces:WorkspaceProvisionUseCases){}
  private fail(error:unknown):never {
    if(error instanceof InvalidWorkspaceProvisioning)throw new BadRequestException(error.message);
    if(error instanceof WorkspaceLoginRequired)throw new ForbiddenException(error.message);
    if(error instanceof WorkspaceSlugTaken)throw new ConflictException(error.message);
    if(error instanceof WorkspaceCreationFailed)throw new InternalServerErrorException(error.message);
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage academies');
  }
  @Get()
  async list(@Req() request:AuthenticatedRequest){
    try{return await this.workspaces.list(request.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
  @Post()
  async create(@Req() request:AuthenticatedRequest,@Body() raw:unknown){
    try{return await this.workspaces.create(request.academyUser!.id,raw);}
    catch(e){return this.fail(e);}
  }
}
