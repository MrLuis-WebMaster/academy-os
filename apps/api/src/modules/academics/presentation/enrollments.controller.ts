import {
 BadRequestException,Body,ConflictException,Controller,Delete,ForbiddenException,
 InternalServerErrorException,Param,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidEnrollment} from '../domain/enrollment.js';
import {SubjectAccessDenied} from '../application/subject-use-cases.js';
import {EnrollmentUseCases,EnrollmentExists,EnrollmentNotFound,InvalidEnrollmentScope} from '../application/enrollment-use-cases.js';
import {NotFoundException} from '@nestjs/common';

@Controller('workspaces/:workspaceId/enrollments')
export class EnrollmentsController {
  constructor(private readonly useCases:EnrollmentUseCases) {}
  private translate(error:unknown):never {
    if(error instanceof SubjectAccessDenied)throw new ForbiddenException(error.message);
    if(error instanceof InvalidEnrollment||error instanceof InvalidEnrollmentScope)throw new BadRequestException(error.message);
    if(error instanceof EnrollmentExists)throw new ConflictException(error.message);
    if(error instanceof EnrollmentNotFound)throw new NotFoundException(error.message);
    throw new InternalServerErrorException('Unable to update enrollment');
  }

  @Post()
  async enroll(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown) {
    try {return await this.useCases.enroll(workspaceId,request.academyUser!.id,input);}
    catch(error){return this.translate(error);}
  }

  @Delete(':courseId/:studentUserId')
  async unenroll(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('courseId') courseId:string,@Param('studentUserId') studentUserId:string) {
    try {return await this.useCases.unenroll(workspaceId,request.academyUser!.id,{courseId,studentUserId});}
    catch(error){return this.translate(error);}
  }
}
