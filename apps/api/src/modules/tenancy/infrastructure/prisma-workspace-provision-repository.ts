import {prisma} from '../../../lib/prisma.js';
import {slugify} from '../../../shared/domain/slug.js';
import type {WorkspaceProvisionRepository,ProvisionWorkspaceDraft} from '../application/workspace-ports.js';
import {
  WorkspaceCreationFailed,WorkspaceSlugTaken,
} from '../application/workspace-provision-use-cases.js';

export class PrismaWorkspaceProvisionRepository implements WorkspaceProvisionRepository {
  async list(userId:string){
    return prisma.workspaceMember.findMany({
      where:{userId},
      select:{
        role:true,workspace:{select:{
          id:true,name:true,slug:true,type:true,brandColor:true,timezone:true,
        }},
      },
      orderBy:{joinedAt:'asc'},
    });
  }

  async provision(userId:string,draft:ProvisionWorkspaceDraft){
    const unique={userId_requestId:{userId,requestId:draft.requestId}};
    const previous=await prisma.setupRequest.findUnique({
      where:unique,include:{workspace:true},
    });
    if(previous)return {...previous.workspace,role:'OWNER' as const};
    try{
      return await prisma.$transaction(async tx=>{
        // Both duplicate submissions and replays of the same provisioning request
        // serialize before querying the idempotency key.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:setup:'+userId+':'+draft.requestId}))::text AS lock_acquired`;
        const existing=await tx.setupRequest.findUnique({
          where:unique,include:{workspace:true},
        });
        if(existing)return {...existing.workspace,role:'OWNER' as const};
        const workspace=await tx.workspace.create({
          data:{
            name:draft.name,slug:draft.slug,type:draft.type,timezone:draft.timezone,
            members:{create:{userId,role:'OWNER'}},
            teachers:{create:{userId}},
            subjects:{create:draft.subjects.map(name=>({name,slug:slugify(name)}))},
          },
        });
        await tx.setupRequest.create({
          data:{userId,requestId:draft.requestId,workspaceId:workspace.id},
        });
        return {...workspace,role:'OWNER' as const};
      });
    }catch(error){
      const winner=await prisma.setupRequest.findUnique({
        where:unique,include:{workspace:true},
      });
      if(winner)return {...winner.workspace,role:'OWNER' as const};
      if(typeof error==='object'&&error!==null&&'code'in error&&error.code==='P2002'){
        throw new WorkspaceSlugTaken();
      }
      throw new WorkspaceCreationFailed();
    }
  }
}
