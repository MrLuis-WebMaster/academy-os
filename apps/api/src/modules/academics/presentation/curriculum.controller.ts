import {
  BadRequestException,Body,Controller,Delete,ForbiddenException,Get,
  HttpException,InternalServerErrorException,NotFoundException,Param,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidCurriculumInput} from '../domain/curriculum.js';
import {
  CurriculumAccessDenied,CurriculumCourseMissing,CurriculumParentInvalid,
  CurriculumTeacherMissing,CurriculumTeacherNotAssigned,CurriculumUseCases,
} from '../application/curriculum-use-cases.js';

@Controller('workspaces/:workspaceId/curriculum')
export class CurriculumController {
  constructor(private readonly curriculum:CurriculumUseCases){}
  private fail(error:unknown):never{
    if(error instanceof InvalidCurriculumInput||error instanceof CurriculumParentInvalid||
      error instanceof CurriculumTeacherMissing)throw new BadRequestException(error.message);
    if(error instanceof CurriculumAccessDenied||error instanceof CurriculumTeacherNotAssigned){
      throw new ForbiddenException(error.message);
    }
    if(error instanceof CurriculumCourseMissing)throw new NotFoundException(error.message);
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage curriculum');
  }
  @Get('courses/:courseId')
  async show(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('courseId') courseId:string){
    try{return await this.curriculum.show(workspaceId,req.academyUser!.id,courseId);}
    catch(e){return this.fail(e);}
  }
  @Post('courses/:courseId/teachers')
  async assign(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('courseId') courseId:string,@Body() body:unknown){
    try{return await this.curriculum.assign(workspaceId,req.academyUser!.id,courseId,body);}
    catch(e){return this.fail(e);}
  }
  @Delete('courses/:courseId/teachers/:teacherId')
  async unassign(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('courseId') courseId:string,@Param('teacherId') teacherId:string){
    try{return await this.curriculum.unassign(workspaceId,req.academyUser!.id,courseId,teacherId);}
    catch(e){return this.fail(e);}
  }
  @Post('courses/:courseId/topics')
  async createTopic(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('courseId') courseId:string,@Body() body:unknown){
    try{return await this.curriculum.createTopic(workspaceId,req.academyUser!.id,courseId,body);}
    catch(e){return this.fail(e);}
  }
}
