import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,
  Get,HttpException,InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {
  CompletedLessonCannotBeCancelled,InvalidLessonInput,LessonTeacherMismatch,
} from '../domain/lesson.js';
import {
  LessonAccessDenied,LessonConflict,LessonNotFound,LessonReferenceInvalid,LessonUseCases,
} from '../application/lesson-use-cases.js';

@Controller('workspaces/:workspaceId/sessions')
export class LessonsController {
  constructor(private readonly lessons:LessonUseCases){}
  private fail(error:unknown):never {
    if(error instanceof InvalidLessonInput)throw new BadRequestException(error.details);
    if(error instanceof LessonReferenceInvalid)throw new BadRequestException(error.message);
    if(error instanceof CompletedLessonCannotBeCancelled)throw new BadRequestException(error.message);
    if(error instanceof LessonAccessDenied||error instanceof LessonTeacherMismatch){
      throw new ForbiddenException(error.message);
    }
    if(error instanceof LessonNotFound)throw new NotFoundException(error.message);
    if(error instanceof LessonConflict)throw new ConflictException(error.message);
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage lessons');
  }

  @Get()
  async list(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string) {
    try{return await this.lessons.list(workspaceId,request.academyUser!.id);}
    catch(error){return this.fail(error);}
  }
  @Post()
  async create(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Body() input:unknown) {
    try{return await this.lessons.create(workspaceId,request.academyUser!.id,input);}
    catch(error){return this.fail(error);}
  }
  @Patch(':sessionId/cancel')
  async cancel(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('sessionId') sessionId:string) {
    try{return await this.lessons.cancel(workspaceId,request.academyUser!.id,sessionId);}
    catch(error){return this.fail(error);}
  }
}
