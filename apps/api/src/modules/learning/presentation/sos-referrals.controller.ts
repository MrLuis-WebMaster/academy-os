import {
 BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,
 InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidSosReferral} from '../domain/sos-referral.js';
import {
 SosReferralDenied,SosReferralLimitReached,SosReferralNotFound,SosReferralUseCases,
} from '../application/sos-referral-use-cases.js';

@Controller('workspaces/:workspaceId/profe-sos/referrals')
export class SosReferralsController{
 constructor(private readonly useCases:SosReferralUseCases){}
 private fail(error:unknown):never{
  if(error instanceof InvalidSosReferral)throw new BadRequestException(error.message);
  if(error instanceof SosReferralDenied)throw new ForbiddenException(error.message);
  if(error instanceof SosReferralNotFound)throw new NotFoundException(error.message);
  if(error instanceof SosReferralLimitReached)throw new ConflictException(error.message);
  throw new InternalServerErrorException('Unable to manage student questions');
 }
 @Post()
 async send(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
  try{return await this.useCases.send(workspaceId,req.academyUser!.id,input);}
  catch(e){return this.fail(e);}
 }
 @Get('mine')
 async mine(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.useCases.mine(workspaceId,req.academyUser!.id);}
  catch(e){return this.fail(e);}
 }
 @Get('staff')
 async staff(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.useCases.staff(workspaceId,req.academyUser!.id);}
  catch(e){return this.fail(e);}
 }
 @Patch(':referralId/resolve')
 async resolve(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('referralId') referralId:string,@Body() input:unknown){
  try{return await this.useCases.resolve(workspaceId,req.academyUser!.id,referralId,input);}
  catch(e){return this.fail(e);}
 }
}
