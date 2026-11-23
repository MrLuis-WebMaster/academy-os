import {
 BadRequestException,Body,ConflictException,Controller,ForbiddenException,
 InternalServerErrorException,Param,Post,Req,
} from '@nestjs/common';
import {z} from 'zod';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {bookingInput} from '../domain/lesson.js';
import {InvalidWeeklySeries} from '../domain/weekly-series.js';
import {
 CreateWeeklySeriesUseCase,WeeklySeriesConflict,WeeklySeriesNotAllowed,WeeklySeriesReferenceInvalid,
} from '../application/create-weekly-series-use-case.js';

@Controller('workspaces/:workspaceId/sessions')
export class WeeklySeriesController {
 constructor(private readonly useCases:CreateWeeklySeriesUseCase){}
 @Post('weekly-series')
 async create(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
  const original=bookingInput.safeParse(input);
  const repeat=input&&typeof input==='object'&&'repeatWeeks'in input
    ?z.number().int().min(2).max(16).safeParse(input.repeatWeeks):null;
  if(!original.success||!repeat?.success){
   throw new BadRequestException('Provide valid class details and a weekly count between 2 and 16');
  }
  const {startsAt,endsAt,...other}=original.data;
  try{
   return await this.useCases.execute(workspaceId,request.academyUser!.id,{
    ...other,startsAt:new Date(startsAt),endsAt:new Date(endsAt),repeatWeeks:repeat.data,
   });
  }catch(error){
   if(error instanceof InvalidWeeklySeries||error instanceof WeeklySeriesReferenceInvalid)
    throw new BadRequestException(error.message);
   if(error instanceof WeeklySeriesNotAllowed)throw new ForbiddenException(error.message);
   if(error instanceof WeeklySeriesConflict)throw new ConflictException(error.message);
   throw new InternalServerErrorException('Unable to schedule weekly lessons');
  }
 }
}
