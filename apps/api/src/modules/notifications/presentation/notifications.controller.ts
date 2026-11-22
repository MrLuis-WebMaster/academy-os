import {
 BadRequestException,Controller,ForbiddenException,Get,InternalServerErrorException,
 NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {NotificationUseCases,NotificationAccessDenied,NotificationNotFound} from '../application/notification-use-cases.js';
import {InvalidNotificationIdentifier} from '../domain/notification.js';

@Controller('workspaces/:workspaceId/notifications')
export class NotificationsController {
 constructor(private readonly inbox:NotificationUseCases){}
 private fail(error:unknown):never {
  if(error instanceof NotificationAccessDenied)throw new ForbiddenException(error.message);
  if(error instanceof NotificationNotFound)throw new NotFoundException(error.message);
  if(error instanceof InvalidNotificationIdentifier)throw new BadRequestException(error.message);
  throw new InternalServerErrorException('Unable to manage notifications');
 }
 @Get()
 async list(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string) {
  try{return await this.inbox.list(workspaceId,request.academyUser!.id);}
  catch(error){return this.fail(error);}
 }
 @Patch(':notificationId/read')
 async read(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('notificationId') notificationId:string){
  try{return await this.inbox.read(workspaceId,request.academyUser!.id,notificationId);}
  catch(error){return this.fail(error);}
 }
 @Post('read-all')
 async readAll(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.inbox.readAll(workspaceId,request.academyUser!.id);}
  catch(error){return this.fail(error);}
 }
}
