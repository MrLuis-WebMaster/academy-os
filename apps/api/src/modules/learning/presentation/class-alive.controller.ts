import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,
  HttpException,InternalServerErrorException,NotFoundException,Param,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidClassReflection,InvalidReflectionSessionId} from '../domain/class-reflection.js';
import {
  ReflectionAccessDenied,ReflectionConflict,ReflectionNoCourse,ReflectionNotFound,
  ReflectionTeacherMismatch,ReflectionUseCases,
} from '../application/reflection-use-cases.js';

@Controller('workspaces/:workspaceId/class-alive')
export class ClassAliveController {
  constructor(private readonly reflections:ReflectionUseCases){}
  private fail(error:unknown):never {
    if(error instanceof InvalidClassReflection||error instanceof InvalidReflectionSessionId||error instanceof ReflectionNoCourse)
      throw new BadRequestException(error.message);
    if(error instanceof ReflectionAccessDenied||error instanceof ReflectionTeacherMismatch)
      throw new ForbiddenException(error.message);
    if(error instanceof ReflectionNotFound)throw new NotFoundException(error.message);
    if(error instanceof ReflectionConflict)throw new ConflictException(error.message);
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage Class Alive notes');
  }

  @Post('sessions/:sessionId/notes')
  async save(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('sessionId') sessionId:string,@Body() body:unknown){
    try{return await this.reflections.save(workspaceId,req.academyUser!.id,sessionId,body);}
    catch(error){return this.fail(error);}
  }
  @Post('sessions/:sessionId/publish')
  async publish(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('sessionId') sessionId:string){
    try{return await this.reflections.publish(workspaceId,req.academyUser!.id,sessionId);}
    catch(error){return this.fail(error);}
  }
  @Get('notes')
  async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.reflections.listStaff(workspaceId,req.academyUser!.id);}
    catch(error){return this.fail(error);}
  }
  @Get('published')
  async published(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.reflections.listStudent(workspaceId,req.academyUser!.id);}
    catch(error){return this.fail(error);}
  }
}
