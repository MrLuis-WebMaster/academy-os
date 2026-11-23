import {
  BadRequestException,Body,Controller,ForbiddenException,GoneException,
  HttpException,HttpStatus,InternalServerErrorException,Param,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidInvitation} from '../domain/invitation.js';
import {
  InvitationAccessDenied,InvitationLimitReached,InvitationRoleDenied,
  InvitationUnavailable,InvitationUseCases,InvitationWrongEmail,
} from '../application/invitation-use-cases.js';

@Controller()
export class InvitationsController {
  constructor(private readonly invitations:InvitationUseCases){}

  private fail(error:unknown):never {
    if(error instanceof InvalidInvitation)throw new BadRequestException(error.message);
    if(error instanceof InvitationAccessDenied||error instanceof InvitationRoleDenied||
      error instanceof InvitationWrongEmail)throw new ForbiddenException(error.message);
    if(error instanceof InvitationUnavailable)throw new GoneException(error.message);
    if(error instanceof InvitationLimitReached){
      throw new HttpException(error.message,HttpStatus.TOO_MANY_REQUESTS);
    }
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage invitations');
  }

  @Post('workspaces/:workspaceId/invitations')
  async invite(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() body:unknown) {
    try{
      const {token,...record}=await this.invitations.issue(workspaceId,req.academyUser!.id,body);
      const origin=process.env.WEB_ORIGIN||'http://localhost:5173';
      return {...record,inviteUrl:(origin.endsWith('/')?origin.slice(0,-1):origin)+'/?invite='+encodeURIComponent(token)};
    }catch(error){return this.fail(error);}
  }

  @Post('invitations/accept')
  async accept(@Req() req:AuthenticatedRequest,@Body() body:unknown) {
    try{
      return await this.invitations.accept(
        req.academyUser!.id,req.academyUser!.email,body,
      );
    }catch(error){return this.fail(error);}
  }
}
