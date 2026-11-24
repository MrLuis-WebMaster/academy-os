import {Controller,Get,Post,Delete,Req,Param,Query,Res,Body,ConflictException,BadGatewayException,ForbiddenException,BadRequestException,ServiceUnavailableException,InternalServerErrorException} from '@nestjs/common';
import type {Response} from 'express';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {ExportClassToCalendar} from '../application/calendar-use-cases.js';
import {CalendarSyncConflict,CalendarProviderError} from '../domain/calendar-event.js';
import {GoogleCalendarConnection} from '../application/google-use-cases.js';
import {IntegrationDenied,IntegrationUnavailable,InvalidAuthorization} from '../domain/google-connection.js';

@Controller()
export class GoogleConnectionController{
 constructor(private readonly connection:GoogleCalendarConnection,private readonly exporter:ExportClassToCalendar){}
 private assertOrigin(req:AuthenticatedRequest){
  const expected=new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin;
  if(req.headers.origin!==expected)throw new ForbiddenException('Invalid request origin');
 }
 private translate(error:unknown):never{
  if(error instanceof CalendarSyncConflict)throw new ConflictException(error.message);
  if(error instanceof CalendarProviderError)throw new BadGatewayException(error.message);
  if(error instanceof IntegrationDenied)throw new ForbiddenException(error.message);
  if(error instanceof IntegrationUnavailable)throw new ServiceUnavailableException(error.message);
  if(error instanceof InvalidAuthorization)throw new BadRequestException(error.message);
  throw new InternalServerErrorException('Integration request could not be completed');
 }
 @Get('workspaces/:workspaceId/integrations/google-calendar')
 async status(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.connection.status(workspaceId,req.academyUser!.id);}catch(e){return this.translate(e);}
 }
 @Post('workspaces/:workspaceId/integrations/google-calendar/authorize')
 async authorize(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  this.assertOrigin(req);
  try{return await this.connection.start(workspaceId,req.academyUser!.id);}catch(e){return this.translate(e);}
 }
 @Get('integrations/google-calendar/callback')
 async callback(@Req() req:AuthenticatedRequest,@Query('state') state:unknown,@Query('code') code:unknown,@Res() res:Response){
  const target=new URL('/',process.env.WEB_ORIGIN||'http://localhost:5173');
  try{
   await this.connection.complete(req.academyUser!.id,state,code);
   target.searchParams.set('calendarConnection','connected');
  }catch{
   target.searchParams.set('calendarConnection','failed');
  }
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  return res.redirect(303,target.toString());
 }
 @Get('workspaces/:workspaceId/integrations/google-calendar/classes/:sessionId/sync')
 async syncStatus(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('sessionId') sessionId:string){
  try{return await this.exporter.status(workspaceId,req.academyUser!.id,sessionId);}catch(e){return this.translate(e);}
 }
 @Delete('workspaces/:workspaceId/integrations/google-calendar/classes/:sessionId/sync')
 async stopSync(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('sessionId') sessionId:string){
  this.assertOrigin(req);
  try{return await this.exporter.stop(workspaceId,req.academyUser!.id,sessionId);}catch(e){return this.translate(e);}
 }
 @Post('workspaces/:workspaceId/integrations/google-calendar/classes/:sessionId/export')
 async exportClass(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('sessionId') sessionId:string,@Body() raw:unknown){
  this.assertOrigin(req);
  try{return await this.exporter.execute(workspaceId,req.academyUser!.id,sessionId,raw);}catch(e){return this.translate(e);}
 }
 @Delete('workspaces/:workspaceId/integrations/google-calendar')
 async disconnect(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  this.assertOrigin(req);
  try{return await this.connection.disconnect(workspaceId,req.academyUser!.id);}catch(e){return this.translate(e);}
 }
}
