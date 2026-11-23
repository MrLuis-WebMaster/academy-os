import {
  BadRequestException,Body,Controller,ForbiddenException,Get,
  InternalServerErrorException,NotFoundException,Param,Patch,Query,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidHolidaySettings} from '../domain/public-holidays.js';
import {
  HolidayPolicyAccessDenied,HolidayPolicyMissing,HolidayPolicyUseCases,
} from '../application/holiday-policy-use-cases.js';

@Controller('workspaces/:workspaceId/scheduling')
export class HolidayPolicyController {
  constructor(private readonly policies:HolidayPolicyUseCases){}
  private fail(error:unknown):never{
    if(error instanceof InvalidHolidaySettings)throw new BadRequestException(error.message);
    if(error instanceof HolidayPolicyAccessDenied)throw new ForbiddenException(error.message);
    if(error instanceof HolidayPolicyMissing)throw new NotFoundException(error.message);
    throw new InternalServerErrorException('Unable to manage holiday calendar');
  }
  @Get('holiday-settings')
  async settings(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    try{return await this.policies.read(workspaceId,req.academyUser!.id);}
    catch(e){return this.fail(e);}
  }
  @Patch('holiday-settings')
  async update(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Body() raw:unknown){
    try{return await this.policies.update(workspaceId,req.academyUser!.id,raw);}
    catch(e){return this.fail(e);}
  }
  @Get('holidays')
  async calendar(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Query('year') year:string){
    try{return await this.policies.calendar(workspaceId,req.academyUser!.id,year);}
    catch(e){return this.fail(e);}
  }
}
