import {
  Controller,ForbiddenException,Get,InternalServerErrorException,Param,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {
  BookingHistoryAccessDenied,StudentBookingHistoryUseCase,
} from '../application/student-booking-history.js';

@Controller('workspaces/:workspaceId/bookings')
export class StudentBookingsController {
  constructor(private readonly history:StudentBookingHistoryUseCase){}
  @Get('mine')
  async mine(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.history.execute(workspaceId,req.academyUser!.id);}
    catch(error){
      if(error instanceof BookingHistoryAccessDenied)throw new ForbiddenException(error.message);
      throw new InternalServerErrorException('Unable to load reservation history');
    }
  }
}
