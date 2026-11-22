import {
 BadRequestException,Controller,ForbiddenException,InternalServerErrorException,
 NotFoundException,Param,Patch,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidSeriesIdentifier} from '../domain/series-cancellation.js';
import {CancelFutureSeriesUseCase,SeriesCancellationDenied,SeriesCancellationNotFound} from '../application/cancel-future-series-use-case.js';

@Controller('workspaces/:workspaceId/sessions/weekly-series')
export class SeriesCancellationController {
 constructor(private readonly useCases:CancelFutureSeriesUseCase){}
 @Patch(':seriesId/cancel-future')
 async cancelFuture(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
  @Param('seriesId') seriesId:string){
  try{return await this.useCases.execute(workspaceId,req.academyUser!.id,seriesId);}
  catch(error){
   if(error instanceof InvalidSeriesIdentifier)throw new BadRequestException(error.message);
   if(error instanceof SeriesCancellationDenied)throw new ForbiddenException(error.message);
   if(error instanceof SeriesCancellationNotFound)throw new NotFoundException(error.message);
   throw new InternalServerErrorException('Unable to cancel future weekly lessons');
  }
 }
}
