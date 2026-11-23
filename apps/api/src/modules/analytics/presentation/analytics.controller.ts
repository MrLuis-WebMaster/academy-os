import {
  BadRequestException,Controller,ForbiddenException,Get,InternalServerErrorException,
  Param,Query,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidAnalyticsPeriod} from '../domain/analytics-period.js';
import {AnalyticsUseCases,AnalyticsAccessDenied} from '../application/analytics-use-cases.js';

@Controller('workspaces/:workspaceId/analytics')
export class AnalyticsController {
  constructor(private readonly useCases:AnalyticsUseCases){}
  @Get('overview')
  async overview(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Query('period') period?:string){
    try{return await this.useCases.overview(workspaceId,req.academyUser!.id,period);}
    catch(error){
      if(error instanceof InvalidAnalyticsPeriod)throw new BadRequestException(error.message);
      if(error instanceof AnalyticsAccessDenied)throw new ForbiddenException(error.message);
      throw new InternalServerErrorException('Unable to calculate academy analytics');
    }
  }
}
