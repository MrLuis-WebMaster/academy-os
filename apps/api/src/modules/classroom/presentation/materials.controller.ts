import {
  BadRequestException,Body,ConflictException,Controller,ForbiddenException,
  Get,HttpException,InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,
} from '@nestjs/common';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {InvalidMaterialInput,MaterialNotPublishable} from '../domain/material.js';
import {
  MaterialAccessDenied,MaterialCourseOutsideWorkspace,MaterialNotFound,MaterialUseCases,
} from '../application/material-use-cases.js';

@Controller('workspaces/:workspaceId/materials')
export class MaterialsController {
  constructor(private readonly materials:MaterialUseCases){}

  private fail(error:unknown):never {
    if(error instanceof MaterialAccessDenied)throw new ForbiddenException(error.message);
    if(error instanceof InvalidMaterialInput)throw new BadRequestException(error.details);
    if(error instanceof MaterialCourseOutsideWorkspace)throw new BadRequestException(error.message);
    if(error instanceof MaterialNotFound)throw new NotFoundException(error.message);
    if(error instanceof MaterialNotPublishable)throw new ConflictException(error.message);
    if(error instanceof HttpException)throw error;
    throw new InternalServerErrorException('Unable to manage classroom materials');
  }

  @Get()
  async list(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string) {
    try{return await this.materials.list(workspaceId,request.academyUser!.id);}
    catch(error){return this.fail(error);}
  }

  @Post()
  async create(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Body() input:unknown) {
    try{return await this.materials.create(workspaceId,request.academyUser!.id,input);}
    catch(error){return this.fail(error);}
  }

  @Patch(':materialId/publication')
  async setPublished(@Req() request:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,
    @Param('materialId') materialId:string,@Body() input:unknown) {
    try{return await this.materials.setPublished(workspaceId,request.academyUser!.id,materialId,input);}
    catch(error){return this.fail(error);}
  }
}
