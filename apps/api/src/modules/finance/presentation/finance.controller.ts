import {
  BadRequestException,Body,Controller,ForbiddenException,Get,HttpException,
  InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidReceiptInput} from '../domain/manual-receipt.js';
import {
  ActiveReceiptNotFound,CourseOutsideWorkspace,FinanceAccessDenied,
  FinanceUseCases,StudentOutsideWorkspace,
} from '../application/finance-use-cases.js';

@Controller('workspaces/:workspaceId/finance')
export class FinanceController {
  constructor(private readonly finance:FinanceUseCases){}

  private fail(error:unknown):never {
    if(error instanceof FinanceAccessDenied)throw new ForbiddenException(error.message);
    if(error instanceof InvalidReceiptInput)throw new BadRequestException(error.details);
    if(error instanceof StudentOutsideWorkspace||error instanceof CourseOutsideWorkspace){
      throw new BadRequestException(error.message);
    }
    if(error instanceof ActiveReceiptNotFound)throw new NotFoundException(error.message);
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage manual receipts');
  }

  @Get('receipts')
  async receipts(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.finance.list(workspaceId,request.academyUser!.id);}
    catch(error){return this.fail(error);}
  }

  @Get('summary')
  async summary(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.finance.summary(workspaceId,request.academyUser!.id);}
    catch(error){return this.fail(error);}
  }

  @Post('receipts')
  async record(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
    try{return await this.finance.record(workspaceId,request.academyUser!.id,input);}
    catch(error){return this.fail(error);}
  }

  @Patch('receipts/:receiptId/void')
  async voidReceipt(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('receiptId') receiptId:string,@Body() input:unknown){
    try{return await this.finance.voidReceipt(workspaceId,request.academyUser!.id,receiptId,input);}
    catch(error){return this.fail(error);}
  }
}
