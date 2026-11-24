import {BadRequestException,Body,ConflictException,Controller,Delete,ForbiddenException,Get,HttpException,InternalServerErrorException,NotFoundException,Param,Patch,Post,Req,Res,ServiceUnavailableException,UploadedFile,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import type {Response} from 'express';
import type {AuthenticatedRequest} from '../../../auth/session.guard.js';
import {PrivateMaterialUseCases} from '../application/private-material-use-cases.js';
import {MAX_FILE_BYTES,InvalidPrivateMaterial,PrivateMaterialDenied,PrivateMaterialMissing,PrivateMaterialQuota,PrivateMaterialDisabled} from '../domain/private-material.js';

@Controller('workspaces/:workspaceId/material-files')
export class PrivateMaterialsController{
 constructor(private readonly files:PrivateMaterialUseCases){}
 private origin(req:AuthenticatedRequest){
  if(req.headers.origin!==new URL(process.env.WEB_ORIGIN||'http://localhost:5173').origin)
   throw new ForbiddenException('Invalid request origin');
 }
 private fail(e:unknown):never{
  if(e instanceof InvalidPrivateMaterial)throw new BadRequestException(e.message);
  if(e instanceof PrivateMaterialDenied)throw new ForbiddenException(e.message);
  if(e instanceof PrivateMaterialMissing)throw new NotFoundException(e.message);
  if(e instanceof PrivateMaterialQuota)throw new ConflictException(e.message);
  if(e instanceof PrivateMaterialDisabled)throw new ServiceUnavailableException(e.message);
  if(e instanceof HttpException)throw e;
  throw new InternalServerErrorException('Unable to manage private material');
 }
 @Get()
 async list(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
  try{return await this.files.list(workspaceId,req.academyUser!.id);}catch(e){return this.fail(e);}
 }
 @Post()
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:MAX_FILE_BYTES,files:1,fields:2,fieldSize:1024,parts:3}}))
 async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() raw:unknown,@UploadedFile() file:unknown){
  this.origin(req);
  try{return await this.files.create(workspaceId,req.academyUser!.id,raw,file);}catch(e){return this.fail(e);}
 }
 @Patch(':id/publication')
 async publish(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('id') id:string,@Body() raw:unknown){
  this.origin(req);
  try{return await this.files.publish(workspaceId,req.academyUser!.id,id,raw);}catch(e){return this.fail(e);}
 }
 @Delete(':id')
 async remove(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('id') id:string){
  this.origin(req);
  try{return await this.files.remove(workspaceId,req.academyUser!.id,id);}catch(e){return this.fail(e);}
 }
 @Get(':id/download')
 async download(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('id') id:string,@Res() res:Response){
  try{
   const file=await this.files.download(workspaceId,req.academyUser!.id,id);
   const filename=file.filename.replace(/[^a-zA-Z0-9_.-]/g,'_');
   res.setHeader('Cache-Control','private, no-store');
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
   res.setHeader('Content-Type','application/octet-stream');
   res.setHeader('Content-Disposition','attachment; filename="'+filename+'"');
   res.setHeader('Content-Length',file.content.byteLength);
   res.end(Buffer.from(file.content));
  }catch(e){return this.fail(e);}
 }
}
