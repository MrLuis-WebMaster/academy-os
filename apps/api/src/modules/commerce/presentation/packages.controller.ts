import {
 BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,
 InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidPackageInput} from '../domain/class-package.js';
import {ClassPackagesUseCases,PackageAccessDenied,PackageConflict,PackageNotFound} from '../application/package-use-cases.js';

@Controller('workspaces/:workspaceId/packages')
export class ClassPackagesController{
 constructor(private readonly useCases:ClassPackagesUseCases){}
 private translate(error:unknown):never{
  if(error instanceof InvalidPackageInput)throw new BadRequestException(error.message);
  if(error instanceof PackageAccessDenied)throw new ForbiddenException(error.message);
  if(error instanceof PackageNotFound)throw new NotFoundException(error.message);
  if(error instanceof PackageConflict)throw new ConflictException(error.message);
  throw new InternalServerErrorException('Unable to manage class packages');
 }
 @Get()
 async plans(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.useCases.plans(workspaceId,req.academyUser!.id);}
  catch(e){return this.translate(e);}
 }
 @Post()
 async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() raw:unknown){
  try{return await this.useCases.create(workspaceId,req.academyUser!.id,raw);}
  catch(e){return this.translate(e);}
 }
 @Patch(':packageId/active')
 async active(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('packageId') packageId:string,@Body() raw:unknown){
  try{return await this.useCases.setActive(workspaceId,req.academyUser!.id,packageId,raw);}
  catch(e){return this.translate(e);}
 }
 @Post(':packageId/issue')
 async issue(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('packageId') packageId:string,@Body() raw:unknown){
  try{return await this.useCases.issue(workspaceId,req.academyUser!.id,packageId,raw);}
  catch(e){return this.translate(e);}
 }
 @Get('issuances')
 async issuances(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.useCases.issuances(workspaceId,req.academyUser!.id);}
  catch(e){return this.translate(e);}
 }
 @Patch('entitlements/:entitlementId/revoke')
 async revoke(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('entitlementId') entitlementId:string,@Body() raw:unknown){
  try{return await this.useCases.revoke(workspaceId,req.academyUser!.id,entitlementId,raw);}
  catch(e){return this.translate(e);}
 }
 @Get('mine')
 async mine(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.useCases.mine(workspaceId,req.academyUser!.id);}
  catch(e){return this.translate(e);}
 }
 @Post('redeem')
 async redeem(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() raw:unknown){
  try{return await this.useCases.redeem(workspaceId,req.academyUser!.id,raw);}
  catch(e){return this.translate(e);}
 }
}
