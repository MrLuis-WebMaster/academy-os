import {Controller,Get,Post,Req,Param,Query,Body,ForbiddenException,BadRequestException,NotFoundException,InternalServerErrorException} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {BillingUseCases} from '../application/billing-use-cases.js';
import {SaasDenied,SaasInvalid,SaasMissing} from '../domain/plan.js';
@Controller()
export class BillingController{
 constructor(private readonly billing:BillingUseCases){}
 private origin(req:AuthenticatedRequest){if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)throw new ForbiddenException('Invalid origin');}
 private fail(e:unknown):never{
  if(e instanceof SaasDenied)throw new ForbiddenException(e.message);
  if(e instanceof SaasInvalid)throw new BadRequestException(e.message);
  if(e instanceof SaasMissing)throw new NotFoundException(e.message);
  throw new InternalServerErrorException('Billing unavailable');
 }
 @Get('workspaces/:workspaceId/saas-billing') async mine(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Query('after') after:unknown){try{return await this.billing.mine(w,req.academyUser!.id,after);}catch(e){return this.fail(e);}}
 @Post('workspaces/:workspaceId/saas-billing') async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Body() raw:unknown){this.origin(req);try{return await this.billing.create(w,req.academyUser!.id,raw);}catch(e){return this.fail(e);}}
 @Post('workspaces/:workspaceId/saas-billing/:id/cancel') async cancel(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Param('id') id:string){this.origin(req);try{return await this.billing.cancel(w,req.academyUser!.id,id);}catch(e){return this.fail(e);}}
 @Get('platform/academies/:workspaceId/billing') async platform(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Query('after') after:unknown){try{return await this.billing.platform(w,req.academyUser!.id,after);}catch(e){return this.fail(e);}}
 @Post('platform/academies/:workspaceId/billing/:id/review') async review(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Param('id') id:string,@Body() raw:unknown){this.origin(req);try{return await this.billing.review(w,req.academyUser!.id,id,raw);}catch(e){return this.fail(e);}}
}
