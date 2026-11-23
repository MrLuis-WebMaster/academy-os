import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,
  InternalServerErrorException,NotFoundException,Param,Patch,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidSeriesIdentifier} from '../domain/series-cancellation.js';
import {InvalidSeriesEdit} from '../domain/series-edit.js';
import {InvalidLessonInput} from '../domain/lesson.js';
import {
  EditFutureSeriesUseCase,SeriesEditConflict,SeriesEditDenied,SeriesEditNotFound,
} from '../application/edit-future-series.js';

@Controller('workspaces/:workspaceId/sessions/weekly-series')
export class SeriesEditController {
  constructor(private readonly useCases:EditFutureSeriesUseCase){}
  @Patch(':seriesId/future')
  async edit(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('seriesId') seriesId:string,@Body() raw:unknown){
    try{return await this.useCases.execute(workspaceId,req.academyUser!.id,seriesId,raw);}
    catch(error){
      if(error instanceof InvalidSeriesIdentifier||error instanceof InvalidSeriesEdit||
        error instanceof InvalidLessonInput)
        throw new BadRequestException(error.message);
      if(error instanceof SeriesEditDenied)throw new ForbiddenException(error.message);
      if(error instanceof SeriesEditNotFound)throw new NotFoundException(error.message);
      if(error instanceof SeriesEditConflict)throw new ConflictException(error.message);
      throw new InternalServerErrorException('Unable to edit weekly class series');
    }
  }
}
