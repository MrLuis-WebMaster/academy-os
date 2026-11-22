import {Controller,ForbiddenException,Get,InternalServerErrorException,Param,Req,Res} from '@nestjs/common';
import type {Response} from 'express';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {ExportCalendarUseCase,CalendarAccessDenied} from '../application/export-calendar-use-case.js';

@Controller('workspaces/:workspaceId')
export class CalendarController {
 constructor(private readonly exporter:ExportCalendarUseCase){}
 @Get('calendar.ics')
 async download(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Res({passthrough:true}) response:Response){
  try{
   const document=await this.exporter.execute(workspaceId,req.academyUser!.id);
   response.setHeader('Content-Type','text/calendar; charset=utf-8');
   response.setHeader('Content-Disposition','attachment; filename="academy-os-calendar.ics"');
   response.setHeader('Cache-Control','private, no-store');
   response.setHeader('X-Content-Type-Options','nosniff');
   return document;
  }catch(error){
   if(error instanceof CalendarAccessDenied)throw new ForbiddenException(error.message);
   throw new InternalServerErrorException('Calendar export is unavailable');
  }
 }
}
