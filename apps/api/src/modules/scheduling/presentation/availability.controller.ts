import {
 BadRequestException,Body,ConflictException,Controller,Delete,ForbiddenException,
 Get,InternalServerErrorException,NotFoundException,Param,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidWeeklySlot} from '../domain/weekly-availability.js';
import {
 AvailabilityConflict,AvailabilityInvalidTeacher,AvailabilityPermissionDenied,AvailabilitySlotNotFound,ManageAvailabilityUseCase
} from '../application/manage-availability-use-case.js';

@Controller('workspaces/:workspaceId/availability')
export class AvailabilityController {
  constructor(private readonly slots:ManageAvailabilityUseCase){}
  private map(error:unknown):never{
    if(error instanceof AvailabilityPermissionDenied)throw new ForbiddenException(error.message);
    if(error instanceof InvalidWeeklySlot||error instanceof AvailabilityInvalidTeacher)throw new BadRequestException(error.message);
    if(error instanceof AvailabilityConflict)throw new ConflictException(error.message);
    if(error instanceof AvailabilitySlotNotFound)throw new NotFoundException(error.message);
    throw new InternalServerErrorException('Cannot manage teacher availability');
  }
  @Get()
  async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.slots.list(workspaceId,req.academyUser!.id);}
    catch(error){return this.map(error);}
  }
  @Post()
  async add(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
    try{return await this.slots.add(workspaceId,req.academyUser!.id,input);}
    catch(error){return this.map(error);}
  }
  @Delete(':slotId')
  async remove(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('slotId') slotId:string){
    try{return await this.slots.remove(workspaceId,req.academyUser!.id,slotId);}
    catch(error){return this.map(error);}
  }
}
