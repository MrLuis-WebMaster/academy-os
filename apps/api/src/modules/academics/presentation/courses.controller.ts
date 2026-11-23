import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,Patch,
  InternalServerErrorException,Param,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {CourseUseCases,CourseSubjectOutsideWorkspace,CoursePolicyConflict,CourseNotFound} from '../application/course-use-cases.js';
import {SubjectAccessDenied} from '../application/subject-use-cases.js';
import {InvalidCourseDetails} from '../domain/course-draft.js';

@Controller('workspaces/:workspaceId/courses')
export class CoursesController {
  constructor(private readonly courses:CourseUseCases) {}

  private fail(error:unknown):never {
    if(error instanceof SubjectAccessDenied)throw new ForbiddenException(error.message);
    if(error instanceof CoursePolicyConflict)throw new ConflictException(error.message);
    if(error instanceof CourseNotFound)throw new BadRequestException(error.message);
    if(error instanceof CourseSubjectOutsideWorkspace||error instanceof InvalidCourseDetails){
      throw new BadRequestException(error.message);
    }
    throw new InternalServerErrorException('Unable to process courses');
  }

  @Get()
  async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.courses.list(workspaceId,req.academyUser!.id);}
    catch(error){return this.fail(error);}
  }

  @Patch(':courseId/package-policy')
  async packagePolicy(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('courseId') courseId:string,@Body() raw:unknown){
    try{return await this.courses.setPackageRequirement(workspaceId,req.academyUser!.id,courseId,raw);}
    catch(error){return this.fail(error);}
  }

  @Post()
  async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() body:unknown){
    try{return await this.courses.create(workspaceId,req.academyUser!.id,body);}
    catch(error){return this.fail(error);}
  }
}
