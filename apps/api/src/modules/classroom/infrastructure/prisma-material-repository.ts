import {prisma} from '../../../lib/prisma.js';
import type {MaterialRepository} from '../application/ports.js';
import type {CreateExternalMaterial} from '../domain/material.js';
import {ensurePublishableMaterial} from '../domain/material.js';
import {
  MaterialAccessDenied,MaterialCourseOutsideWorkspace,MaterialNotFound,
} from '../application/material-use-cases.js';

export class PrismaMaterialRepository implements MaterialRepository {
  async listByWorkspace(workspaceId:string) {
    return prisma.resource.findMany({
      where:{workspaceId,source:{not:'UPLOAD'}},
      select:{
        id:true,title:true,url:true,courseId:true,published:true,source:true,aiAuthorized:true,
      },
      orderBy:{title:'asc'},take:150,
    });
  }

  async create(workspaceId:string,actorId:string,material:CreateExternalMaterial) {
    return prisma.$transaction(async tx=>{
      const [manager,course]=await Promise.all([
        tx.workspaceMember.findFirst({
          where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},select:{id:true},
        }),
        tx.course.findFirst({
          where:{workspaceId,id:material.courseId},select:{id:true},
        }),
      ]);
      if(!manager)throw new MaterialAccessDenied();
      if(!course)throw new MaterialCourseOutsideWorkspace();
      return tx.resource.create({
        data:{
          workspaceId,courseId:course.id,title:material.title,url:material.url,
          source:'EXTERNAL_URL',published:material.published,aiAuthorized:false,
        },
        select:{id:true,title:true,url:true,courseId:true,published:true},
      });
    });
  }

  async setPublished(workspaceId:string,actorId:string,materialId:string,published:boolean) {
    return prisma.$transaction(async tx=>{
      const [manager,material]=await Promise.all([
        tx.workspaceMember.findFirst({
          where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},select:{id:true},
        }),
        tx.resource.findFirst({
          where:{id:materialId,workspaceId},
          select:{
            id:true,source:true,url:true,courseId:true,published:true,
            course:{select:{workspaceId:true}},
          },
        }),
      ]);
      if(!manager)throw new MaterialAccessDenied();
      if(!material)throw new MaterialNotFound();
      if(published){
        ensurePublishableMaterial({
          source:material.source,url:material.url,courseId:material.courseId,
          courseWorkspaceId:material.course?.workspaceId===workspaceId?workspaceId:null,
        });
      }
      if(material.published!==published){
        const updated=await tx.resource.updateMany({
          where:{id:materialId,workspaceId},
          data:{published},
        });
        if(updated.count!==1)throw new MaterialNotFound();
      }
      return {id:materialId,published};
    });
  }
}
