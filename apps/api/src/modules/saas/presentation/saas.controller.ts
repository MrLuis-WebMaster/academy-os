import {Controller,Get,Patch,Req,Param,Query,Body,ForbiddenException,BadRequestException,NotFoundException,InternalServerErrorException} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {SaasUseCases} from '../application/use-cases.js';
import {SaasDenied,SaasInvalid,SaasMissing} from '../domain/plan.js';
@Controller()
export class SaasController{
 constructor(private readonly saas:SaasUseCases){}
 private fail(e:unknown):never{
  if(e instanceof SaasDenied)throw new ForbiddenException(e.message);
  if(e instanceof SaasInvalid)throw new BadRequestException(e.message);
  if(e instanceof SaasMissing)throw new NotFoundException(e.message);
  throw new InternalServerErrorException('Unable to manage SaaS plan');
 }
 @Get('workspaces/:workspaceId/saas-plan') async summary(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string){try{return await this.saas.summary(w,req.academyUser!.id);}catch(e){return this.fail(e);}}
 @Get('platform/access') async access(@Req() req:AuthenticatedRequest){return this.saas.access(req.academyUser!.id);}
 @Get('platform/academies') async list(@Req() req:AuthenticatedRequest,@Query('after') after:unknown){try{return await this.saas.list(req.academyUser!.id,after);}catch(e){return this.fail(e);}}
 @Get('platform/overview') async overview(@Req() req:AuthenticatedRequest){try{return await this.saas.overview(req.academyUser!.id);}catch(e){return this.fail(e);}}
 @Get('platform/academies/:workspaceId/audit') async audit(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Query('after') after:unknown){try{return await this.saas.audit(req.academyUser!.id,w,after);}catch(e){return this.fail(e);}}
 @Patch('platform/academies/:workspaceId/plan') async assign(@Req() req:AuthenticatedRequest,@Param('workspaceId') w:string,@Body() raw:unknown){
  if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)throw new ForbiddenException('Invalid request origin');
  try{return await this.saas.assign(req.academyUser!.id,w,raw);}catch(e){return this.fail(e);}
 }
}
