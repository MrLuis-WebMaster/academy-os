import {Controller,Get,Post,Req,Param,Query,Body,ForbiddenException,NotFoundException,ConflictException,InternalServerErrorException} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {PaymentCaseUseCases} from '../application/payment-case-use-cases.js';
import {CheckoutConflict,CheckoutUnavailable} from '../domain/checkout.js';
@Controller('workspaces/:workspaceId/payment-cases')
export class PaymentCasesController{
 constructor(private readonly cases:PaymentCaseUseCases){}
 private fail(e:unknown):never{
  if(e instanceof CheckoutUnavailable)throw new NotFoundException(e.message);
  if(e instanceof CheckoutConflict)throw new ConflictException(e.message);
  throw new InternalServerErrorException('Payment case unavailable');
 }
 @Get() async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Query('after') after:unknown){try{return await this.cases.list(w,req.academyUser!.id,after);}catch(e){return this.fail(e);}}
 @Get(':orderId') async detail(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Param('orderId') id:string){try{return await this.cases.detail(w,req.academyUser!.id,id);}catch(e){return this.fail(e);}}
 @Post(':orderId/actions') async action(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Param('orderId') id:string,@Body() raw:unknown){
  if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)throw new ForbiddenException('Invalid origin');
  try{return await this.cases.apply(w,req.academyUser!.id,id,raw);}catch(e){return this.fail(e);}
 }
}
