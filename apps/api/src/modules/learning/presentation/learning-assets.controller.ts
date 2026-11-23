import {
 BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,
 InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidLearningAsset} from '../domain/learning-asset.js';
import {
 LearningAssetsUseCases,LearningAssetDenied,LearningAssetNotFound,LearningAssetConflict,
} from '../application/learning-assets-use-cases.js';

@Controller('workspaces/:workspaceId/learning-assets')
export class LearningAssetsController{
 constructor(private readonly useCases:LearningAssetsUseCases){}
 private fail(error:unknown):never{
  if(error instanceof InvalidLearningAsset)throw new BadRequestException(error.message);
  if(error instanceof LearningAssetDenied)throw new ForbiddenException(error.message);
  if(error instanceof LearningAssetNotFound)throw new NotFoundException(error.message);
  if(error instanceof LearningAssetConflict)throw new ConflictException(error.message);
  throw new InternalServerErrorException('Unable to manage Class Alive learning content');
 }
 @Get('staff')
 async staff(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.useCases.staff(workspaceId,req.academyUser!.id);}
  catch(e){return this.fail(e);}
 }
 @Get('student')
 async student(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.useCases.student(workspaceId,req.academyUser!.id);}
  catch(e){return this.fail(e);}
 }
 @Post()
 async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() raw:unknown){
  try{return await this.useCases.create(workspaceId,req.academyUser!.id,raw);}
  catch(e){return this.fail(e);}
 }
 @Patch(':assetId')
 async revise(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('assetId') assetId:string,@Body() raw:unknown){
  try{return await this.useCases.revise(workspaceId,req.academyUser!.id,assetId,raw);}
  catch(e){return this.fail(e);}
 }
 @Post(':assetId/publish')
 async publish(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('assetId') assetId:string){
  try{return await this.useCases.publish(workspaceId,req.academyUser!.id,assetId);}
  catch(e){return this.fail(e);}
 }
}
