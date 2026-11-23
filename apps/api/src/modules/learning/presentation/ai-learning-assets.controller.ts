import {
 BadRequestException,Body,Controller,ForbiddenException,HttpException,HttpStatus,
 InternalServerErrorException,NotFoundException,Param,Post,Req,ServiceUnavailableException,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {
 AiConsentRequired,AiNotesNotFound,AiPermissionDenied,AiProviderNotConfigured,AiQuotaReached,
} from '../application/suggest-practice-use-case.js';
import {
 AiLearningAssetInvalid,AiLearningAssetOutputInvalid,SuggestLearningAssetUseCase,
} from '../application/suggest-learning-asset.js';
import {LearningAssetNotFound} from '../application/learning-assets-use-cases.js';

@Controller('workspaces/:workspaceId/class-alive')
export class AiLearningAssetsController{
 constructor(private readonly useCases:SuggestLearningAssetUseCase){}
 @Post('sessions/:sessionId/suggest-asset')
 async suggest(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('sessionId') sessionId:string,@Body() raw:unknown){
  try{return await this.useCases.execute(workspaceId,req.academyUser!.id,sessionId,raw);}
  catch(error){
   if(error instanceof AiPermissionDenied)throw new ForbiddenException(error.message);
   if(error instanceof AiConsentRequired||error instanceof AiLearningAssetInvalid)throw new BadRequestException(error.message);
   if(error instanceof AiNotesNotFound||error instanceof LearningAssetNotFound)throw new NotFoundException(error.message);
   if(error instanceof AiQuotaReached)throw new HttpException(error.message,HttpStatus.TOO_MANY_REQUESTS);
   if(error instanceof AiProviderNotConfigured||error instanceof AiLearningAssetOutputInvalid){
    throw new ServiceUnavailableException(error.message);
   }
   throw new InternalServerErrorException('Unable to propose a learning resource');
  }
 }
}
