import {
 BadRequestException,Body,ConflictException,Controller,ForbiddenException,
 InternalServerErrorException,NotFoundException,Param,Patch,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidReschedule} from '../domain/reschedule.js';
import {
 RescheduleLessonUseCase,SessionRescheduleDenied,SessionRescheduleMissing,SessionRescheduleConflict
} from '../application/reschedule-use-case.js';

@Controller('workspaces/:workspaceId/sessions')
export class RescheduleController {
  constructor(private readonly reschedule:RescheduleLessonUseCase){}
  @Patch(':sessionId/reschedule')
  async execute(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('sessionId') sessionId:string,@Body() body:unknown) {
    try{return await this.reschedule.execute(workspaceId,req.academyUser!.id,sessionId,body);}
    catch(error){
      if(error instanceof InvalidReschedule)throw new BadRequestException(error.message);
      if(error instanceof SessionRescheduleDenied)throw new ForbiddenException(error.message);
      if(error instanceof SessionRescheduleMissing)throw new NotFoundException(error.message);
      if(error instanceof SessionRescheduleConflict)throw new ConflictException(error.message);
      throw new InternalServerErrorException('Unable to reschedule this lesson');
    }
  }
}
