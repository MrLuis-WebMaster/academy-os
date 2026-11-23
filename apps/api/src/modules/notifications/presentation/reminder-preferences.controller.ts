import {
  BadRequestException,Body,Controller,ForbiddenException,Get,
  InternalServerErrorException,Patch,Param,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidReminderPreferences} from '../domain/reminder-policy.js';
import {
  ReminderPreferenceAccessDenied,ReminderPreferencesUseCases,
} from '../application/reminder-use-cases.js';

@Controller('workspaces/:workspaceId/notifications/reminder-preferences')
export class ReminderPreferencesController {
  constructor(private readonly preferences:ReminderPreferencesUseCases){}
  private fail(error:unknown):never{
    if(error instanceof InvalidReminderPreferences)throw new BadRequestException(error.message);
    if(error instanceof ReminderPreferenceAccessDenied)throw new ForbiddenException(error.message);
    throw new InternalServerErrorException('Unable to configure class reminders');
  }
  @Get()
  async read(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.preferences.read(workspaceId,req.academyUser!.id);}
    catch(error){return this.fail(error);}
  }
  @Patch()
  async save(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Body() raw:unknown){
    try{return await this.preferences.save(workspaceId,req.academyUser!.id,raw);}
    catch(error){return this.fail(error);}
  }
}
