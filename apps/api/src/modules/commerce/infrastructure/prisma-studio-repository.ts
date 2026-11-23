import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {StudioRepository,StudioSettings,StudioNewOffering} from '../application/studio-ports.js';
import {
  StudioAccessDenied,StudioCourseInvalid,StudioOfferingMissing,StudioUnavailable,
} from '../application/studio-use-cases.js';

export class PrismaStudioRepository implements StudioRepository {
  private async requireManager(tx:Prisma.TransactionClient,workspaceId:string,actorId:string){
    if(!await tx.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},select:{id:true},
    }))throw new StudioAccessDenied();
  }

  async publicStore(slug:string){
    const workspace=await prisma.workspace.findFirst({
      where:{slug,publicEnabled:true},
      select:{
        id:true,name:true,slug:true,description:true,brandColor:true,contactUrl:true,timezone:true,
      },
    });
    if(!workspace)return null;
    // Never show offers that point at a course owned by another academy.
    const offerings=await prisma.offering.findMany({
      where:{
        workspaceId:workspace.id,published:true,
        OR:[{courseId:null},{course:{workspaceId:workspace.id}}],
      },
      orderBy:{createdAt:'desc'},
      select:{
        id:true,title:true,description:true,priceCOP:true,durationMinutes:true,mode:true,
        course:{select:{title:true,subject:{select:{name:true}}}},
      },
    });
    const {id:_,...publicDetails}=workspace;
    return {...publicDetails,offerings};
  }

  async config(workspaceId:string,actorId:string){
    const manager=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},select:{id:true},
    });
    if(!manager)throw new StudioAccessDenied();
    const workspace=await prisma.workspace.findUnique({
      where:{id:workspaceId},
      select:{
        id:true,name:true,slug:true,description:true,contactUrl:true,
        publicEnabled:true,brandColor:true,timezone:true,
      },
    });
    if(!workspace)throw new StudioUnavailable('Workspace does not exist');
    return workspace;
  }

  async update(workspaceId:string,actorId:string,input:StudioSettings){
    return prisma.$transaction(async tx=>{
      await this.requireManager(tx,workspaceId,actorId);
      const changed=await tx.workspace.updateMany({
        where:{id:workspaceId},
        data:{...input,contactUrl:input.contactUrl||null},
      });
      if(changed.count!==1)throw new StudioUnavailable('Workspace does not exist');
      return tx.workspace.findUniqueOrThrow({
        where:{id:workspaceId},
        select:{id:true,slug:true,name:true,description:true,contactUrl:true,publicEnabled:true},
      });
    });
  }

  async offerings(workspaceId:string,actorId:string){
    const manager=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},select:{id:true},
    });
    if(!manager)throw new StudioAccessDenied();
    return prisma.offering.findMany({
      where:{workspaceId},
      select:{
        id:true,title:true,description:true,priceCOP:true,durationMinutes:true,
        mode:true,published:true,courseId:true,
      },
      orderBy:{createdAt:'desc'},take:150,
    });
  }

  async create(workspaceId:string,actorId:string,input:StudioNewOffering){
    return prisma.$transaction(async tx=>{
      await this.requireManager(tx,workspaceId,actorId);
      const {courseId,...data}=input;
      if(courseId&&!await tx.course.findFirst({
        where:{id:courseId,workspaceId},select:{id:true},
      }))throw new StudioCourseInvalid();
      return tx.offering.create({
        data:{workspaceId,...data,courseId:courseId||null,published:false},
        select:{id:true,title:true,priceCOP:true,published:true},
      });
    });
  }

  async setPublished(workspaceId:string,actorId:string,offeringId:string,published:boolean){
    return prisma.$transaction(async tx=>{
      await this.requireManager(tx,workspaceId,actorId);
      const offering=await tx.offering.findFirst({
        where:{workspaceId,id:offeringId},select:{id:true,courseId:true},
      });
      if(!offering)throw new StudioOfferingMissing();
      if(published&&offering.courseId&&!await tx.course.findFirst({
        where:{id:offering.courseId,workspaceId},select:{id:true},
      }))throw new StudioCourseInvalid();
      const updated=await tx.offering.updateMany({
        where:{id:offeringId,workspaceId},data:{published},
      });
      if(updated.count!==1)throw new StudioOfferingMissing();
      return {id:offeringId,published};
    });
  }
}
