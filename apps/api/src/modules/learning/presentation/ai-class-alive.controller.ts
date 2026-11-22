import {
 BadRequestException,Body,Controller,ForbiddenException,InternalServerErrorException,
 NotFoundException,Param,Post,Req,ServiceUnavailableException,TooManyRequestsException,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {AiSuggestionInvalid} from '../domain/suggestion.js';
import {
 AiConsentRequired,AiNotesNotFound,AiPermissionDenied,AiProviderNotConfigured,AiQuotaReached,SuggestClassPracticeUseCase
} from '../application/suggest-practice-use-case.js';

@Controller('workspaces/:workspaceId/class-alive')
export class AiClassAliveController {
  constructor(private readonly suggestions:SuggestClassPracticeUseCase){}
  @Post('sessions/:sessionId/suggest-practice')
  async suggest(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('sessionId') sessionId:string,@Body() payload:unknown) {
    try {return await this.suggestions.execute(workspaceId,req.academyUser!.id,sessionId,payload);}
    catch(error){
      if(error instanceof AiPermissionDenied)throw new ForbiddenException(error.message);
      if(error instanceof AiConsentRequired)throw new BadRequestException(error.message);
      if(error instanceof AiNotesNotFound)throw new NotFoundException(error.message);
      if(error instanceof AiQuotaReached)throw new TooManyRequestsException(error.message);
      if(error instanceof AiProviderNotConfigured)throw new ServiceUnavailableException(error.message);
      if(error instanceof AiSuggestionInvalid)throw new ServiceUnavailableException(error.message);
      throw new InternalServerErrorException('Unable to generate practice; no activity was published');
    }
  }
}
