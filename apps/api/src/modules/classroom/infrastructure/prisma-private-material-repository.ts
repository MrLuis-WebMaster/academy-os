import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {PrivateMaterialRepository} from '../application/private-material-ports.js';
import {MAX_WORKSPACE_BYTES,PrivateMaterialDenied,PrivateMaterialMissing,PrivateMaterialQuota,type PrivateMaterialInput} from '../domain/private-material.js';

async function roles(tx:Prisma.TransactionClient,workspaceId:string,userId:string){
 const rows=await tx.workspaceMember.findMany({where:{workspaceId,userId},select:{role:true}});
 return {manager:rows.some(r=>r.role==='OWNER'||r.role==='ADMIN'),teacher:rows.some(r=>r.role==='TEACHER'),student:rows.some(r=>r.role==='STUDENT')};
}
function staffScope(workspaceId:string,userId:string,manager:boolean):Prisma.ResourceWhereInput{
 return {workspaceId,source:'UPLOAD',course:{is:{workspaceId,...(manager?{}:{teachers:{some:{teacher:{workspaceId,userId}}}})}}};
}
async function staff(tx:Prisma.TransactionClient,workspaceId:string,userId:string){
 const access=await roles(tx,workspaceId,userId);
 if(!access.manager&&!access.teacher)throw new PrivateMaterialDenied('Material management is restricted');
 return access;
}
async function lock(tx:Prisma.TransactionClient,workspaceId:string){
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:private-material:'+workspaceId}))::text`;
}
const meta={filename:true,mimeType:true,sizeBytes:true,createdAt:true,resource:{select:{id:true,courseId:true,title:true,published:true}}} as const;
type Metadata={filename:string;mimeType:string;sizeBytes:number;createdAt:Date;resource:{id:string;courseId:string|null;title:string;published:boolean}};
function view(row:Metadata){const {resource,...file}=row;return {...resource,...file};}
export class PrismaPrivateMaterialRepository implements PrivateMaterialRepository{
 async list(workspaceId:string,userId:string){
  return prisma.$transaction(async tx=>{
   const access=await staff(tx,workspaceId,userId);
   const rows=await tx.privateMaterialFile.findMany({where:{resource:staffScope(workspaceId,userId,access.manager)},select:meta,orderBy:{createdAt:'desc'},take:200});
   return rows.map(view);
  });
 }
 async create(workspaceId:string,userId:string,input:PrivateMaterialInput){
  return prisma.$transaction(async tx=>{
   await lock(tx,workspaceId);
   const access=await staff(tx,workspaceId,userId);
   const course=await tx.course.findFirst({where:{id:input.courseId,workspaceId,...(access.manager?{}:{teachers:{some:{teacher:{workspaceId,userId}}}})},select:{id:true}});
   if(!course)throw new PrivateMaterialMissing('Course not available');
   const usage=await tx.privateMaterialFile.aggregate({where:{resource:{workspaceId}},_sum:{sizeBytes:true}});
   if((usage._sum.sizeBytes??0)+input.sizeBytes>MAX_WORKSPACE_BYTES)throw new PrivateMaterialQuota('Academy private file quota exceeded');
   const resource=await tx.resource.create({data:{workspaceId,courseId:course.id,title:input.title,source:'UPLOAD',published:false,aiAuthorized:false},select:{id:true}});
   const row=await tx.privateMaterialFile.create({data:{resourceId:resource.id,filename:input.filename,mimeType:input.mimeType,sizeBytes:input.sizeBytes,content:Buffer.from(input.content)},select:meta});
   return view(row);
  });
 }
 async setPublished(workspaceId:string,userId:string,id:string,published:boolean){
  return prisma.$transaction(async tx=>{
   await lock(tx,workspaceId);
   const access=await staff(tx,workspaceId,userId);
   const row=await tx.resource.updateMany({where:{id,...staffScope(workspaceId,userId,access.manager),privateFile:{isNot:null}},data:{published}});
   if(row.count!==1)throw new PrivateMaterialMissing('Material not available');
   return {id,published};
  });
 }
 async remove(workspaceId:string,userId:string,id:string){
  await prisma.$transaction(async tx=>{
   await lock(tx,workspaceId);
   const access=await staff(tx,workspaceId,userId);
   const row=await tx.resource.deleteMany({where:{id,...staffScope(workspaceId,userId,access.manager),privateFile:{isNot:null}}});
   if(row.count!==1)throw new PrivateMaterialMissing('Material not available');
  });
 }
 async download(workspaceId:string,userId:string,id:string){
  return prisma.$transaction(async tx=>{
   const access=await roles(tx,workspaceId,userId);
   const scopes:Prisma.ResourceWhereInput[]=[];
   if(access.manager||access.teacher)scopes.push(staffScope(workspaceId,userId,access.manager));
   if(access.student)scopes.push({workspaceId,source:'UPLOAD',published:true,course:{is:{workspaceId,enrollments:{some:{userId}}}}});
   if(!scopes.length)throw new PrivateMaterialMissing('Material not available');
   const row=await tx.privateMaterialFile.findFirst({where:{resourceId:id,resource:{OR:scopes}},select:{filename:true,mimeType:true,content:true}});
   if(!row)throw new PrivateMaterialMissing('Material not available');
   return row;
  });
 }
}
