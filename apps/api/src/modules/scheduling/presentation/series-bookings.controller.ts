import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,
  InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidSeriesIdentifier} from '../domain/series-cancellation.js';
import {
  SeriesBookingAccessDenied,SeriesBookingConflict,SeriesBookingNotEnrolled,
  SeriesBookingNotFound,SeriesBookingUseCases,
} from '../application/series-booking-use-cases.js';

@Controller('workspaces/:workspaceId/bookings/series')
export class SeriesBookingsController {
  constructor(private readonly cases:SeriesBookingUseCases){}
  private fail(error:unknown):never{
    if(error instanceof InvalidSeriesIdentifier)throw new BadRequestException(error.message);
    if(error instanceof SeriesBookingAccessDenied||error instanceof SeriesBookingNotEnrolled)
      throw new ForbiddenException(error.message);
    if(error instanceof SeriesBookingNotFound)throw new NotFoundException(error.message);
    if(error instanceof SeriesBookingConflict)throw new ConflictException(error.message);
    throw new InternalServerErrorException('Unable to change bookings for the series');
  }
  @Post()
  async reserve(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() body:unknown){
    const id=body&&typeof body==='object'&&'seriesId' in body?body.seriesId:null;
    try{return await this.cases.reserve(workspaceId,req.academyUser!.id,id);}
    catch(error){return this.fail(error);}
  }
  @Patch(':seriesId/cancel-future')
  async cancelFuture(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('seriesId') seriesId:string){
    try{return await this.cases.cancelFuture(workspaceId,req.academyUser!.id,seriesId);}
    catch(error){return this.fail(error);}
  }
}
