import {prisma} from '../../../lib/prisma.js';
import type {CourseDraft} from '../domain/course-draft.js';
import type {CourseRepository,CourseListItem,CourseCreated} from '../application/course-ports.js';

export class PrismaCourseRepository implements CourseRepository {
  async listByWorkspace(workspaceId:string):Promise<CourseListItem[]>{
    return prisma.course.findMany({
      where:{workspaceId},
      select:{id:true,title:true,summary:true,published:true,subjectId:true,subject:{select:{id:true,name:true}}},
      orderBy:{title:'asc'},
    });
  }
  async subjectExists(workspaceId:string,subjectId:string):Promise<boolean>{
    const row=await prisma.subject.findFirst({where:{id:subjectId,workspaceId},select:{id:true}});
    return Boolean(row);
  }
  async create(workspaceId:string,draft:CourseDraft):Promise<CourseCreated>{
    return prisma.course.create({
      data:{workspaceId,title:draft.title,summary:draft.summary,subjectId:draft.subjectId},
      select:{id:true,title:true,summary:true,subjectId:true},
    });
  }
}
