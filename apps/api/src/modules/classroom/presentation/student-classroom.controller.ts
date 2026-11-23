import {Controller,ForbiddenException,Get,InternalServerErrorException,Param,Req} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {
  StudentClassroomAccessDenied,StudentClassroomUseCases,
} from '../application/student-classroom-read.js';

@Controller('workspaces/:workspaceId')
export class StudentClassroomController {
  constructor(private readonly classroom:StudentClassroomUseCases){}
  @Get('classroom')
  async classroom(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.classroom.list(workspaceId,req.academyUser!.id);}
    catch(e){
      if(e instanceof StudentClassroomAccessDenied)throw new ForbiddenException(e.message);
      throw new InternalServerErrorException('Unable to load student classroom');
    }
  }
}
