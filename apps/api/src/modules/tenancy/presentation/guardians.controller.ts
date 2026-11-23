import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,
  Get,InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidGuardianLink} from '../domain/guardian-link.js';
import {
  GuardianAccessDenied,GuardianLinkConflict,GuardianLinkNotFound,GuardianUseCases,
} from '../application/guardian-use-cases.js';

@Controller('workspaces/:workspaceId/guardians')
export class GuardiansController {
  constructor(private readonly families:GuardianUseCases){}
  private fail(error:unknown):never {
    if(error instanceof InvalidGuardianLink)throw new BadRequestException(error.message);
    if(error instanceof GuardianAccessDenied)throw new ForbiddenException(error.message);
    if(error instanceof GuardianLinkNotFound)throw new NotFoundException(error.message);
    if(error instanceof GuardianLinkConflict)throw new ConflictException(error.message);
    throw new InternalServerErrorException('Unable to manage family relationships');
  }
  @Get('links')
  async links(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.families.links(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
  @Post('links')
  async start(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() raw:unknown){
    try{return await this.families.start(workspaceId,req.academyUser!.id,raw);}
    catch(e){return this.fail(e);}
  }
  @Patch('links/:linkId/approve')
  async approve(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('linkId') linkId:string,@Body() raw:unknown){
    try{return await this.families.approve(workspaceId,req.academyUser!.id,linkId,raw);}
    catch(e){return this.fail(e);}
  }
  @Patch('links/:linkId/revoke')
  async revoke(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('linkId') linkId:string,@Body() raw:unknown){
    try{return await this.families.revoke(workspaceId,req.academyUser!.id,linkId,raw);}
    catch(e){return this.fail(e);}
  }
  @Get('students')
  async students(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.families.students(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
  @Get('students/:studentId/overview')
  async overview(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('studentId') studentId:string){
    try{return await this.families.overview(workspaceId,req.academyUser!.id,studentId);}
    catch(e){return this.fail(e);}
  }
}
