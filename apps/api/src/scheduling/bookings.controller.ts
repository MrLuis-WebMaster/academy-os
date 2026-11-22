import {BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,NotFoundException,Param,Patch,Post,Req} from '@nestjs/common';
import {z} from 'zod';
import {prisma} from '../lib/prisma.js';
import {requireMembership} from '../workspaces/access.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

const reserveInput=z.object({sessionId:z.string().min(1)});
export function hasRoom(capacity:number,reserved:number){return capacity>0&&reserved<capacity;}

@Controller('workspaces/:workspaceId/bookings')
export class BookingsController {
  @Get('mine')
  async mine(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    const userId=req.academyUser!.id;
    await requireMembership(workspaceId,userId,['STUDENT']);
    return prisma.classBooking.findMany({
      where:{workspaceId,userId},
      select:{id:true,status:true,sessionId:true,bookedAt:true,session:{select:{title:true,startsAt:true,mode:true,location:true}}},
      orderBy:{bookedAt:'desc'},
    });
  }

  @Post()
  async reserve(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
    const userId=req.academyUser!.id;
    await requireMembership(workspaceId,userId,['STUDENT']);
    const parsed=reserveInput.safeParse(input);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    const sessionId=parsed.data.sessionId;
    return prisma.$transaction(async tx=>{
      // Serialize only reservations of the same session; parameters are bound.
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))','academy-os:booking:'+sessionId);
      const session=await tx.classSession.findFirst({
        where:{id:sessionId,workspaceId},
        select:{id:true,courseId:true,capacity:true,status:true,startsAt:true},
      });
      if(!session||session.status!=='CONFIRMED')throw new NotFoundException('Open session not found');
      if(session.startsAt<=new Date())throw new ConflictException('Cannot book a lesson that has started');
      if(!session.courseId)throw new BadRequestException('Only classes associated with courses can be reserved by students');
      const enrolled=await tx.enrollment.findFirst({where:{courseId:session.courseId,userId,course:{workspaceId}},select:{id:true}});
      if(!enrolled)throw new ForbiddenException('You must be enrolled in this course first');
      const existing=await tx.classBooking.findUnique({where:{sessionId_userId:{sessionId,userId}},select:{id:true,status:true}});
      if(existing?.status==='BOOKED')return {id:existing.id,sessionId,status:'BOOKED',alreadyBooked:true};
      const reserved=await tx.classBooking.count({where:{sessionId,status:'BOOKED'}});
      if(!hasRoom(session.capacity,reserved))throw new ConflictException('No available places in this session');
      if(existing){
        await tx.classBooking.update({where:{id:existing.id},data:{status:'BOOKED',bookedAt:new Date(),cancelledAt:null}});
        return {id:existing.id,sessionId,status:'BOOKED',alreadyBooked:false};
      }
      const created=await tx.classBooking.create({data:{workspaceId,sessionId,userId},select:{id:true,status:true,sessionId:true}});
      return {...created,alreadyBooked:false};
    });
  }

  @Patch(':bookingId/cancel')
  async cancel(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('bookingId') bookingId:string){
    const userId=req.academyUser!.id;
    await requireMembership(workspaceId,userId,['STUDENT']);
    const booking=await prisma.classBooking.findFirst({
      where:{id:bookingId,workspaceId,userId},select:{id:true,status:true,session:{select:{startsAt:true}}},
    });
    if(!booking)throw new NotFoundException('Booking not found');
    if(booking.status==='CANCELLED')return {id:booking.id,status:'CANCELLED'};
    if(booking.session.startsAt<=new Date())throw new ConflictException('You cannot cancel a session after it begins');
    const updated=await prisma.classBooking.updateMany({
      where:{id:booking.id,workspaceId,userId,status:'BOOKED'},
      data:{status:'CANCELLED',cancelledAt:new Date()},
    });
    if(updated.count!==1)throw new ConflictException('Booking changed, refresh your schedule');
    return {id:booking.id,status:'CANCELLED'};
  }

  @Get('staff')
  async staff(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    const userId=req.academyUser!.id;
    const member=await requireMembership(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    const restricted=member.role==='TEACHER'?{session:{teacher:{userId}}}:{};
    return prisma.classBooking.findMany({
      where:{workspaceId,status:'BOOKED',...restricted},
      select:{id:true,sessionId:true,bookedAt:true,student:{select:{name:true}},session:{select:{title:true,startsAt:true}}},
      take:200,
    });
  }
}
