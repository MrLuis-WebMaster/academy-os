import {Controller,Get,Put,Patch,Req,Param,Body,ForbiddenException,NotFoundException,ConflictException,ServiceUnavailableException,InternalServerErrorException} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {MerchantUseCases} from '../application/merchant-use-cases.js';
import {CheckoutUnavailable,CheckoutConflict,CheckoutDisabled} from '../domain/checkout.js';
@Controller('workspaces/:workspaceId/wompi-merchant')
export class MerchantController{
 constructor(private readonly merchants:MerchantUseCases){}
 private origin(req:AuthenticatedRequest){if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)throw new ForbiddenException('Invalid origin');}
 private fail(e:unknown):never{
  if(e instanceof CheckoutUnavailable)throw new NotFoundException(e.message);
  if(e instanceof CheckoutConflict)throw new ConflictException(e.message);
  if(e instanceof CheckoutDisabled)throw new ServiceUnavailableException(e.message);
  throw new InternalServerErrorException('Merchant configuration unavailable');
 }
 @Get() async status(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string){try{return await this.merchants.status(w,req.academyUser!.id);}catch(e){return this.fail(e);}}
 @Put() async configure(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Body() raw:unknown){this.origin(req);try{return await this.merchants.configure(w,req.academyUser!.id,raw);}catch(e){return this.fail(e);}}
 @Patch('accepting') async accepting(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Body() raw:unknown){this.origin(req);try{return await this.merchants.setAccepting(w,req.academyUser!.id,raw);}catch(e){return this.fail(e);}}
}
