import {Controller,Get,Patch,Req,Param,Body,ForbiddenException,BadRequestException,InternalServerErrorException} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {EmailNoticePreferences} from '../application/email-notice-use-cases.js';
import {EmailNoticeDenied,EmailNoticeInvalid} from '../domain/email-notice.js';
@Controller('workspaces/:workspaceId/notifications/email-preferences')
export class EmailNoticeController{
 constructor(private readonly preferences:EmailNoticePreferences){}
 private fail(e:unknown):never{
  if(e instanceof EmailNoticeDenied)throw new ForbiddenException(e.message);
  if(e instanceof EmailNoticeInvalid)throw new BadRequestException(e.message);
  throw new InternalServerErrorException('Email preferences unavailable');
 }
 @Get() async read(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string){try{return await this.preferences.read(w,req.academyUser!.id);}catch(e){return this.fail(e);}}
 @Patch() async save(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Body() raw:unknown){
  if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)throw new ForbiddenException('Invalid origin');
  try{return await this.preferences.save(w,req.academyUser!.id,raw);}catch(e){return this.fail(e);}
 }
}
