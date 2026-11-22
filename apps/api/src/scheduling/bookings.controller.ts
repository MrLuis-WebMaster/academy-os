import {BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,NotFoundException,Param,Patch,Req} from '@nestjs/common';
import {z} from 'zod';
import {prisma} from '../lib/prisma.js';
import {requireMembership} from '../workspaces/access.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

export {hasRoom} from '../modules/scheduling/domain/booking-policy.js';

@Controller('workspaces/:workspaceId/bookings')
export class BookingsController {
  @Get('mine')
  async mine(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    const userId=req.academyUser!.id;
    await requireMembership(workspaceId,userId,['STUDENT']);
    return prisma.classBooking.findMany({
      where:{workspaceId,userId},
      select:{id:true,status:true,sessionId:true,bookedAt:true,session:{select:{title:true,startsAt:true,mode:true,location:true,status:true,changes:{orderBy:{changedAt:'desc'},take:3,select:{id:true,changedAt:true,reason:true,oldStartsAt:true,newStartsAt:true}}}}},
      orderBy:{bookedAt:'desc'},
    });
  }

  @Patch(':bookingId/attendance')
  async attendance(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('bookingId') bookingId:string,@Body() body:unknown){
    const userId=req.academyUser!.id;
    const membership=await requireMembership(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    const input=z.object({attendance:z.enum(['PRESENT','ABSENT','LATE','EXCUSED'])}).safeParse(body);
    if(!input.success)throw new BadRequestException(input.error.flatten());
    const booking=await prisma.classBooking.findFirst({
      where:{id:bookingId,workspaceId,status:'BOOKED'},
      select:{id:true,session:{select:{status:true,teacher:{select:{userId:true}}}}},
    });
    if(!booking)throw new NotFoundException('Active booking not found');
    if(membership.role==='TEACHER'&&booking.session.teacher?.userId!==userId)
      throw new ForbiddenException('Only the assigned teacher can mark attendance');
    if(booking.session.status==='CANCELLED')throw new ConflictException('Class was cancelled');
    return prisma.classBooking.update({
      where:{id:booking.id},
      data:{attendance:input.data.attendance},
      select:{id:true,attendance:true},
    });
  }

  @Get('staff')
  async staff(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    const userId=req.academyUser!.id;
    const member=await requireMembership(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    const restricted=member.role==='TEACHER'?{session:{teacher:{userId}}}:{};
    return prisma.classBooking.findMany({
      where:{workspaceId,status:'BOOKED',...restricted},
      select:{id:true,sessionId:true,attendance:true,bookedAt:true,student:{select:{name:true}},session:{select:{title:true,startsAt:true}}},
      take:200,
    });
  }
}
