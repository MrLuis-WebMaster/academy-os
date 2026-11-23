import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,
  HttpException,InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidPracticeInput} from '../domain/practice.js';
import {
  PracticeAccessDenied,PracticeConflict,PracticeNotFound,
  PracticePrerequisiteMissing,PracticeUseCases,
} from '../application/practice-use-cases.js';

@Controller('workspaces/:workspaceId/practice')
export class PracticeController {
  constructor(private readonly practices:PracticeUseCases){}

  private fail(error:unknown):never {
    if(error instanceof InvalidPracticeInput||error instanceof PracticePrerequisiteMissing){
      throw new BadRequestException(error instanceof InvalidPracticeInput?error.details:error.message);
    }
    if(error instanceof PracticeAccessDenied)throw new ForbiddenException(error.message);
    if(error instanceof PracticeNotFound)throw new NotFoundException(error.message);
    if(error instanceof PracticeConflict)throw new ConflictException(error.message);
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage learning practices');
  }

  @Post()
  async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() raw:unknown){
    try{return await this.practices.create(workspaceId,req.academyUser!.id,raw);}
    catch(e){return this.fail(e);}
  }
  @Get('teacher')
  async teacher(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.practices.teacher(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
  @Patch(':activityId')
  async revise(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('activityId') activityId:string,@Body() raw:unknown){
    try{return await this.practices.revise(workspaceId,req.academyUser!.id,activityId,raw);}
    catch(e){return this.fail(e);}
  }
  @Post(':activityId/publish')
  async publish(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('activityId') activityId:string){
    try{return await this.practices.publish(workspaceId,req.academyUser!.id,activityId);}
    catch(e){return this.fail(e);}
  }
  @Get('student')
  async student(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.practices.student(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
  @Post(':activityId/attempts')
  async submit(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('activityId') activityId:string,@Body() raw:unknown){
    try{return await this.practices.submit(workspaceId,req.academyUser!.id,activityId,raw);}
    catch(e){return this.fail(e);}
  }
  @Get('passport')
  async passport(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.practices.passport(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
}
