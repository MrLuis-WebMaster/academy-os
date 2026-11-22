import {BadRequestException,Body,ConflictException,Controller,Get,NotFoundException,Param,Patch,Post,Req} from '@nestjs/common';
import type {AuthenticatedRequest} from '../auth/session.guard.js';
import {prisma} from '../lib/prisma.js';
import {requireMembership} from '../workspaces/access.js';
import {receiptInput,voidReceiptInput} from './inputs.js';

@Controller('workspaces/:workspaceId/finance')
export class FinanceController {
  @Get('receipts')
  async receipts(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    return prisma.paymentReceipt.findMany({
      where:{workspaceId},
      select:{id:true,amountCOP:true,method:true,reference:true,receivedAt:true,voidedAt:true,voidReason:true,student:{select:{name:true}},course:{select:{title:true}}},
      take:300,orderBy:{receivedAt:'desc'},
    });
  }

  @Get('summary')
  async summary(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    const result=await prisma.paymentReceipt.aggregate({where:{workspaceId,voidedAt:null},_sum:{amountCOP:true},_count:{id:true}});
    return {currency:'COP',totalReceivedCOP:result._sum.amountCOP??0,receiptCount:result._count.id};
  }

  @Post('receipts')
  async record(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() payload:unknown){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    const parsed=receiptInput.safeParse(payload);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    const {studentUserId,courseId,amountCOP,method,reference}=parsed.data;
    const student=await prisma.workspaceMember.findFirst({where:{workspaceId,userId:studentUserId,role:'STUDENT'},select:{id:true}});
    if(!student)throw new BadRequestException('The student does not belong to this workspace');
    if(courseId){
      const course=await prisma.course.findFirst({where:{id:courseId,workspaceId},select:{id:true}});
      if(!course)throw new BadRequestException('Course does not belong to the workspace');
    }
    return prisma.paymentReceipt.create({
      data:{workspaceId,studentUserId,recordedByUserId:req.academyUser!.id,courseId:courseId||null,amountCOP,method,reference},
      select:{id:true,amountCOP:true,method:true,receivedAt:true},
    });
  }

  @Patch('receipts/:receiptId/void')
  async voidReceipt(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('receiptId') receiptId:string,@Body() payload:unknown){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER']);
    const parsed=voidReceiptInput.safeParse(payload);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    const result=await prisma.paymentReceipt.updateMany({
      where:{id:receiptId,workspaceId,voidedAt:null},
      data:{voidedAt:new Date(),voidReason:parsed.data.reason},
    });
    if(result.count!==1)throw new NotFoundException('Active receipt not found');
    return {id:receiptId,voided:true};
  }
}
