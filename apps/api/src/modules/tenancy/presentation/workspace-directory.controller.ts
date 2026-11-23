import {Controller,ForbiddenException,Get,InternalServerErrorException,Param,Req} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {DirectoryAccessDenied,WorkspaceDirectoryUseCases} from '../application/workspace-directory.js';

@Controller('workspaces/:workspaceId')
export class WorkspaceDirectoryController {
  constructor(private readonly directory:WorkspaceDirectoryUseCases){}
  private fail(error:unknown):never {
    if(error instanceof DirectoryAccessDenied)throw new ForbiddenException(error.message);
    throw new InternalServerErrorException('Unable to read academy directory');
  }
  @Get('people')
  async people(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.directory.people(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
  @Get('teachers')
  async teachers(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.directory.teachers(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
}
