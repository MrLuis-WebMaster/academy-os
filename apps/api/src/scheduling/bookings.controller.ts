import {Controller,Get,Param,Req} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {requireMembership} from '../workspaces/access.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

export {hasRoom} from '../modules/scheduling/domain/booking-policy.js';

/** Student reservation history; staff attendance is in modules/attendance. */
@Controller('workspaces/:workspaceId/bookings')
export class BookingsController {
  @Get('mine')
  async mine(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    const userId=req.academyUser!.id;
    await requireMembership(workspaceId,userId,['STUDENT']);
    return prisma.classBooking.findMany({
      where:{workspaceId,userId},
      select:{
        id:true,status:true,sessionId:true,bookedAt:true,
        session:{select:{
          title:true,startsAt:true,mode:true,location:true,status:true,
          changes:{orderBy:{changedAt:'desc'},take:3,select:{
            id:true,changedAt:true,reason:true,oldStartsAt:true,newStartsAt:true,
          }},
        }},
      },
      orderBy:{bookedAt:'desc'},
    });
  }
}
