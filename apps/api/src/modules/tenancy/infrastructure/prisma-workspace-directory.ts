import {prisma} from '../../../lib/prisma.js';
import type {WorkspaceDirectoryRepository} from '../application/workspace-directory.js';
import {DirectoryAccessDenied} from '../application/workspace-directory.js';

export class PrismaWorkspaceDirectory implements WorkspaceDirectoryRepository {
  private async authorize(workspaceId:string,actorId:string,roles:('OWNER'|'ADMIN'|'TEACHER')[]){
    const member=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:{in:roles}},select:{id:true},
    });
    if(!member)throw new DirectoryAccessDenied();
  }
  async people(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId,['OWNER','ADMIN']);
    return prisma.workspaceMember.findMany({
      where:{workspaceId},
      select:{
        role:true,user:{select:{id:true,name:true,email:true,image:true}},
      },
      orderBy:{joinedAt:'asc'},
    });
  }
  async teachers(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId,['OWNER','ADMIN','TEACHER']);
    return prisma.teacherProfile.findMany({
      where:{workspaceId},
      select:{
        id:true,bio:true,userId:true,
        user:{select:{name:true,image:true}},
      },
    });
  }
}
