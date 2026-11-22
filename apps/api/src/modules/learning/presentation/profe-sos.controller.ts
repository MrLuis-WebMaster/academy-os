import {
 BadRequestException,Body,Controller,ForbiddenException,HttpException,HttpStatus,
 InternalServerErrorException,NotFoundException,Param,Post,Req,ServiceUnavailableException
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {z} from 'zod';
import {AiQuotaReached,AiProviderNotConfigured} from '../application/suggest-practice-use-case.js';
import {AskProfeSosUseCase,InvalidTutorQuestion,TutorNotAllowed,TutorWithoutEvidence} from '../application/ask-profe-sos-use-case.js';

@Controller('workspaces/:workspaceId/profe-sos')
export class ProfeSosController {
  constructor(private readonly tutor:AskProfeSosUseCase){}
  @Post('ask')
  async ask(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
    try{return await this.tutor.execute(workspaceId,req.academyUser!.id,input);}
    catch(error){
      if(error instanceof TutorNotAllowed)throw new ForbiddenException(error.message);
      if(error instanceof InvalidTutorQuestion||error instanceof z.ZodError)throw new BadRequestException('The request or response format is invalid');
      if(error instanceof TutorWithoutEvidence)throw new NotFoundException(error.message);
      if(error instanceof AiProviderNotConfigured)throw new ServiceUnavailableException(error.message);
      if(error instanceof AiQuotaReached)throw new HttpException(error.message,HttpStatus.TOO_MANY_REQUESTS);
      throw new InternalServerErrorException('Profe SOS is unavailable; please ask your teacher');
    }
  }
}
