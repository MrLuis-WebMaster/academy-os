import {Controller,Get,Post,Param,Query,Req,ForbiddenException,NotFoundException,ConflictException,InternalServerErrorException} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {PaymentEventManagement} from '../application/payment-event-inbox.js';
import {CheckoutUnavailable,CheckoutConflict} from '../domain/checkout.js';
@Controller('workspaces/:workspaceId/payment-events')
export class PaymentEventsController{
 constructor(private readonly events:PaymentEventManagement){}
 private fail(e:unknown):never{
  if(e instanceof CheckoutUnavailable)throw new NotFoundException(e.message);
  if(e instanceof CheckoutConflict)throw new ConflictException(e.message);
  throw new InternalServerErrorException('Payment events unavailable');
 }
 @Get() async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Query('after') after:unknown){try{return await this.events.list(w,req.academyUser!.id,after);}catch(e){return this.fail(e);}}
 @Post(':id/retry') async retry(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Param('id') id:string){
  if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)throw new ForbiddenException('Invalid origin');
  try{return await this.events.retry(w,req.academyUser!.id,id);}catch(e){return this.fail(e);}
 }
}
