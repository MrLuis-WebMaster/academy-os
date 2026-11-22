import {
 BadRequestException,Body,ConflictException,Controller,Delete,ForbiddenException,
 Get,InternalServerErrorException,NotFoundException,Param,Post,Req
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidTimeOffWindow} from '../domain/time-off.js';
import {
 ManageTimeOffUseCase,TimeOffConflict,TimeOffNotFound,TimeOffPermissionDenied,TimeOffTeacherUnknown
} from '../application/manage-time-off-use-case.js';

@Controller('workspaces/:workspaceId/availability/exceptions')
export class TeacherTimeOffController {
 constructor(private readonly useCases:ManageTimeOffUseCase){}
 private map(error:unknown):never {
  if(error instanceof TimeOffPermissionDenied)throw new ForbiddenException(error.message);
  if(error instanceof TimeOffTeacherUnknown||error instanceof InvalidTimeOffWindow)throw new BadRequestException(error.message);
  if(error instanceof TimeOffConflict)throw new ConflictException(error.message);
  if(error instanceof TimeOffNotFound)throw new NotFoundException(error.message);
  throw new InternalServerErrorException('Unable to manage time-off exceptions');
 }
 @Get()
 async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.useCases.list(workspaceId,req.academyUser!.id);}
  catch(error){return this.map(error);}
 }
 @Post()
 async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() body:unknown){
  const teacherId=body&&typeof body==='object'&&'teacherProfileId'in body?body.teacherProfileId:undefined;
  try{return await this.useCases.create(workspaceId,req.academyUser!.id,typeof teacherId==='string'?teacherId:'',body);}
  catch(error){return this.map(error);}
 }
 @Delete(':exceptionId')
 async remove(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('exceptionId') exceptionId:string){
  try{return await this.useCases.remove(workspaceId,req.academyUser!.id,exceptionId);}
  catch(error){return this.map(error);}
 }
}
