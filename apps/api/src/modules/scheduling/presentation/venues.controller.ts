import {
 BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,
 InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidVenueInput} from '../domain/venues.js';
import {VenueAccessDenied,VenueConflict,VenueNotFound,VenueUseCases} from '../application/venue-use-cases.js';

@Controller('workspaces/:workspaceId/locations')
export class VenuesController {
 constructor(private readonly venues:VenueUseCases){}
 private fail(error:unknown):never{
  if(error instanceof InvalidVenueInput)throw new BadRequestException(error.message);
  if(error instanceof VenueAccessDenied)throw new ForbiddenException(error.message);
  if(error instanceof VenueNotFound)throw new NotFoundException(error.message);
  if(error instanceof VenueConflict)throw new ConflictException(error.message);
  throw new InternalServerErrorException('Unable to manage campuses and rooms');
 }
 @Get('campuses')
 async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.venues.list(workspaceId,req.academyUser!.id);}
  catch(e){return this.fail(e);}
 }
 @Post('campuses')
 async createCampus(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() body:unknown){
  try{return await this.venues.createCampus(workspaceId,req.academyUser!.id,body);}
  catch(e){return this.fail(e);}
 }
 @Patch('campuses/:campusId')
 async changeCampus(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('campusId') campusId:string,@Body() body:unknown){
  try{return await this.venues.changeCampus(workspaceId,req.academyUser!.id,campusId,body);}
  catch(e){return this.fail(e);}
 }
 @Post('campuses/:campusId/rooms')
 async createRoom(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('campusId') campusId:string,@Body() body:unknown){
  try{return await this.venues.createRoom(workspaceId,req.academyUser!.id,campusId,body);}
  catch(e){return this.fail(e);}
 }
 @Patch('rooms/:roomId')
 async changeRoom(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('roomId') roomId:string,@Body() body:unknown){
  try{return await this.venues.changeRoom(workspaceId,req.academyUser!.id,roomId,body);}
  catch(e){return this.fail(e);}
 }
}
