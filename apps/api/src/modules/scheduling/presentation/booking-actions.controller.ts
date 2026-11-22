import {
 BadRequestException,Body,ConflictException,Controller,ForbiddenException,InternalServerErrorException,
 NotFoundException,Param,Patch,Post,Req
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {BookingPolicyViolation} from '../domain/booking-policy.js';
import {BookingAccessDenied,BookingCapacityConflict,BookingCourseNotAllowed,BookingMissing,BookingUseCases} from '../application/booking-use-cases.js';

@Controller('workspaces/:workspaceId/bookings')
export class BookingActionsController {
  constructor(private readonly useCases:BookingUseCases){}
  private translate(error:unknown):never{
    if(error instanceof BookingAccessDenied||error instanceof BookingCourseNotAllowed)throw new ForbiddenException(error.message);
    if(error instanceof BookingMissing)throw new NotFoundException(error.message);
    if(error instanceof BookingPolicyViolation)throw new BadRequestException(error.message);
    if(error instanceof BookingCapacityConflict)throw new ConflictException(error.message);
    throw new InternalServerErrorException('Unable to manage your booking');
  }
  @Post()
  async reserve(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() payload:unknown){
    const sessionId=payload&&typeof payload==='object'&&'sessionId' in payload?payload.sessionId:undefined;
    try{return await this.useCases.reserve(workspaceId,req.academyUser!.id,sessionId);}
    catch(error){return this.translate(error);}
  }
  @Patch(':bookingId/cancel')
  async cancel(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('bookingId') bookingId:string){
    try{return await this.useCases.cancel(workspaceId,req.academyUser!.id,bookingId);}
    catch(error){return this.translate(error);}
  }
}
