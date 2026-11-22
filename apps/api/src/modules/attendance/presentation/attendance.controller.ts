import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,
  Get,HttpException,InternalServerErrorException,NotFoundException,Param,Patch,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {
  AttendanceAccessDenied,AttendanceChangedConflict,ActiveAttendanceBookingNotFound,
  AttendanceUseCases,
} from '../application/attendance-use-cases.js';
import {
  AttendanceClassCancelled,AttendanceTeacherMismatch,InvalidAttendanceInput,
} from '../domain/attendance-policy.js';

@Controller('workspaces/:workspaceId/bookings')
export class AttendanceController {
  constructor(private readonly attendance:AttendanceUseCases){}

  private fail(error:unknown):never {
    if(error instanceof AttendanceAccessDenied||error instanceof AttendanceTeacherMismatch){
      throw new ForbiddenException(error.message);
    }
    if(error instanceof InvalidAttendanceInput)throw new BadRequestException(error.details);
    if(error instanceof ActiveAttendanceBookingNotFound)throw new NotFoundException(error.message);
    if(error instanceof AttendanceClassCancelled||error instanceof AttendanceChangedConflict){
      throw new ConflictException(error.message);
    }
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage attendance');
  }

  @Get('staff')
  async staff(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.attendance.listStaff(workspaceId,request.academyUser!.id);}
    catch(error){return this.fail(error);}
  }

  @Patch(':bookingId/attendance')
  async mark(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('bookingId') bookingId:string,@Body() body:unknown){
    try{return await this.attendance.mark(workspaceId,request.academyUser!.id,bookingId,body);}
    catch(error){return this.fail(error);}
  }
}
