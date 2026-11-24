import {Controller,Get,Post,Patch,Req,Param,Body,ForbiddenException,BadRequestException,NotFoundException,ConflictException,ServiceUnavailableException,InternalServerErrorException} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {PackageOrderUseCases} from '../application/order-use-cases.js';
import {InvalidOrderInput,OrderDenied,OrderMissing,OrderConflict,OrdersDisabled} from '../domain/package-order.js';
@Controller('workspaces/:workspaceId/package-orders')
export class PackageOrdersController{
 constructor(private readonly orders:PackageOrderUseCases){}
 private origin(req:AuthenticatedRequest){if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)throw new ForbiddenException('Invalid request origin');}
 private fail(e:unknown):never{
  if(e instanceof InvalidOrderInput)throw new BadRequestException(e.message);
  if(e instanceof OrderDenied)throw new ForbiddenException(e.message);
  if(e instanceof OrderMissing)throw new NotFoundException(e.message);
  if(e instanceof OrderConflict)throw new ConflictException(e.message);
  if(e instanceof OrdersDisabled)throw new ServiceUnavailableException(e.message);
  throw new InternalServerErrorException('Unable to manage purchase request');
 }
 @Get('catalog') async catalog(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string){try{return await this.orders.catalog(w,req.academyUser!.id);}catch(e){return this.fail(e);}}
 @Get('mine') async mine(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string){try{return await this.orders.mine(w,req.academyUser!.id);}catch(e){return this.fail(e);}}
 @Post() async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Body() raw:unknown){this.origin(req);try{return await this.orders.create(w,req.academyUser!.id,raw);}catch(e){return this.fail(e);}}
 @Patch(':id/cancel') async cancel(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Param('id') id:string){this.origin(req);try{return await this.orders.cancel(w,req.academyUser!.id,id);}catch(e){return this.fail(e);}}
 @Get() async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string){try{return await this.orders.list(w,req.academyUser!.id);}catch(e){return this.fail(e);}}
 @Patch(':id/review') async review(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Param('id') id:string,@Body() raw:unknown){this.origin(req);try{return await this.orders.review(w,req.academyUser!.id,id,raw);}catch(e){return this.fail(e);}}
}
