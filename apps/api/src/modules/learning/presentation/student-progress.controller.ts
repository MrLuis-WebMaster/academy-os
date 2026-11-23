import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,
  Get,InternalServerErrorException,NotFoundException,Param,Patch,Post,Query,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidStudentProgress} from '../domain/student-progress.js';
import {
  StudentProgressUseCases,ProgressAccessDenied,ProgressConflict,ProgressResourceMissing,
} from '../application/student-progress-use-cases.js';

@Controller('workspaces/:workspaceId/learning-progress')
export class StudentProgressController {
  constructor(private readonly progress:StudentProgressUseCases){}
  private fail(error:unknown):never{
    if(error instanceof InvalidStudentProgress)throw new BadRequestException(error.message);
    if(error instanceof ProgressAccessDenied)throw new ForbiddenException(error.message);
    if(error instanceof ProgressResourceMissing)throw new NotFoundException(error.message);
    if(error instanceof ProgressConflict)throw new ConflictException(error.message);
    throw new InternalServerErrorException('Unable to manage learning progress');
  }
  @Get('student')
  async student(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.progress.student(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
  @Get('student/profile')
  async profile(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.progress.profile(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
  @Get('courses/:courseId')
  async course(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('courseId') courseId:string){
    try{return await this.progress.course(workspaceId,req.academyUser!.id,courseId);}
    catch(e){return this.fail(e);}
  }
  @Post('evidence')
  async evidence(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Body() raw:unknown){
    try{return await this.progress.evidence(workspaceId,req.academyUser!.id,raw);}
    catch(e){return this.fail(e);}
  }
  @Get('evidence')
  async evidenceHistory(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Query('topicId') topicId:string,@Query('studentUserId') studentId:string){
    try{return await this.progress.evidenceHistory(workspaceId,req.academyUser!.id,topicId,studentId);}
    catch(e){return this.fail(e);}
  }
  @Post('goals')
  async createGoal(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Body() raw:unknown){
    try{return await this.progress.createGoal(workspaceId,req.academyUser!.id,raw);}
    catch(e){return this.fail(e);}
  }
  @Patch('goals/:goalId/status')
  async changeGoal(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('goalId') goalId:string,@Body() raw:unknown){
    try{return await this.progress.changeGoal(workspaceId,req.academyUser!.id,goalId,raw);}
    catch(e){return this.fail(e);}
  }
}
