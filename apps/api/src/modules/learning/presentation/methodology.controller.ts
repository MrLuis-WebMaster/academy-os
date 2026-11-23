import {
 BadRequestException,Body,Controller,ForbiddenException,Get,InternalServerErrorException,
 NotFoundException,Param,Put,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidTeachingMethodology} from '../domain/teaching-methodology.js';
import {
 MethodologyAccessDenied,MethodologyNotFound,TeacherMethodologyUseCases,
} from '../application/methodology-use-cases.js';

@Controller('workspaces/:workspaceId/teaching-methods')
export class TeachingMethodologyController{
 constructor(private readonly useCases:TeacherMethodologyUseCases){}
 private fail(error:unknown):never{
  if(error instanceof InvalidTeachingMethodology)throw new BadRequestException(error.message);
  if(error instanceof MethodologyAccessDenied)throw new ForbiddenException(error.message);
  if(error instanceof MethodologyNotFound)throw new NotFoundException(error.message);
  throw new InternalServerErrorException('Unable to configure teacher methodology');
 }
 @Get(':teacherId')
 async read(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('teacherId') teacherId:string){
  try{return await this.useCases.read(workspaceId,req.academyUser!.id,teacherId);}
  catch(e){return this.fail(e);}
 }
 @Put(':teacherId')
 async save(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('teacherId') teacherId:string,@Body() raw:unknown){
  try{return await this.useCases.save(workspaceId,req.academyUser!.id,teacherId,raw);}
  catch(e){return this.fail(e);}
 }
}
