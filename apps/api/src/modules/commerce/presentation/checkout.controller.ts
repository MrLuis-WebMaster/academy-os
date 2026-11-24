import {Controller,Get,Post,Req,Param,Body,HttpCode,ForbiddenException,BadRequestException,NotFoundException,ConflictException,ServiceUnavailableException,InternalServerErrorException} from '@nestjs/common';
import {Public} from '../../../auth/public.js';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {CheckoutUseCases} from '../application/checkout-use-cases.js';
import {CheckoutDisabled,InvalidPaymentEvent,CheckoutUnavailable,CheckoutConflict,PaymentProviderUnavailable} from '../domain/checkout.js';
@Controller()
export class CheckoutController{
 constructor(private readonly checkout:CheckoutUseCases){}
 private fail(e:unknown):never{
  if(e instanceof InvalidPaymentEvent)throw new BadRequestException('Invalid payment event');
  if(e instanceof CheckoutUnavailable)throw new NotFoundException(e.message);
  if(e instanceof CheckoutConflict)throw new ConflictException(e.message);
  if(e instanceof CheckoutDisabled||e instanceof PaymentProviderUnavailable)throw new ServiceUnavailableException(e.message);
  throw new InternalServerErrorException('Payment operation unavailable');
 }
 @Get('workspaces/:workspaceId/package-checkout')
 async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string){try{return await this.checkout.list(w,req.academyUser!.id);}catch(e){return this.fail(e);}}
 @Post('workspaces/:workspaceId/package-checkout/:orderId')
 async start(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Param('orderId') id:string){
  if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)throw new ForbiddenException('Invalid request origin');
  try{return await this.checkout.start(w,req.academyUser!.id,id);}catch(e){return this.fail(e);}
 }
 @Post('workspaces/:workspaceId/package-checkout/:orderId/reconcile')
 async reconcile(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Param('orderId') id:string,@Body() raw:unknown){
  if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)throw new ForbiddenException('Invalid request origin');
  try{return await this.checkout.reconcile(w,req.academyUser!.id,id,raw);}catch(e){return this.fail(e);}
 }
 @Public()
 @Post('payments/wompi/workspaces/:workspaceId/events')
 @HttpCode(200)
 async workspaceEvent(@Param('workspaceId') w:string,@Body() raw:unknown){try{return await this.checkout.webhook(raw,w);}catch(e){return this.fail(e);}}
 @Public()
 @Post('payments/wompi/events')
 @HttpCode(200)
 async event(@Body() raw:unknown){try{return await this.checkout.webhook(raw);}catch(e){return this.fail(e);}}
}
