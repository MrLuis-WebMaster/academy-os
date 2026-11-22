import {BadRequestException,Body,ConflictException,Controller,Delete,ForbiddenException,Get,NotFoundException,Param,Post,Req} from '@nestjs/common';
import {z} from 'zod';
import type {AuthenticatedRequest} from '../auth/session.guard.js';
import {prisma} from '../lib/prisma.js';
import {requireMembership} from './access.js';

export const topicInput=z.object({
  title:z.string().trim().min(2).max(140),
  parentId:z.string().min(1).nullable().optional(),
  order:z.number().int().min(0).max(9999).default(0),
});
export const assignmentInput=z.object({teacherId:z.string().min(1)});

@Controller('workspaces/:workspaceId/curriculum')
export class CurriculumController {
  private async course(workspaceId:string,courseId:string){
    const course=await prisma.course.findFirst({where:{id:courseId,workspaceId},select:{id:true}});
    if(!course)throw new NotFoundException('Course not found in this workspace');
    return course;
  }
  private async canEdit(workspaceId:string,userId:string,courseId:string){
    const member=await requireMembership(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    if(member.role==='TEACHER'){
      const assignment=await prisma.courseTeacher.findFirst({where:{courseId,teacher:{workspaceId,userId}},select:{teacherId:true}});
      if(!assignment)throw new ForbiddenException('Only a teacher assigned to the course may edit its curriculum');
    }
  }

  @Get('courses/:courseId')
  async show(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('courseId') courseId:string){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN','TEACHER']);
    await this.course(workspaceId,courseId);
    const [topics,teachers]=await Promise.all([
      prisma.topic.findMany({where:{courseId},select:{id:true,title:true,parentId:true,order:true},orderBy:[{order:'asc'},{title:'asc'}]}),
      prisma.courseTeacher.findMany({where:{courseId},select:{teacherId:true,teacher:{select:{user:{select:{name:true}}}}}}),
    ]);
    return {courseId,topics,teachers};
  }

  @Post('courses/:courseId/teachers')
  async assign(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('courseId') courseId:string,@Body() input:unknown){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    await this.course(workspaceId,courseId);
    const parsed=assignmentInput.safeParse(input);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    const teacher=await prisma.teacherProfile.findFirst({where:{id:parsed.data.teacherId,workspaceId},select:{id:true}});
    if(!teacher)throw new BadRequestException('Teacher does not belong to this academy');
    return prisma.courseTeacher.upsert({
      where:{courseId_teacherId:{courseId,teacherId:teacher.id}},
      create:{courseId,teacherId:teacher.id},
      update:{},
      select:{teacherId:true,courseId:true},
    });
  }

  @Delete('courses/:courseId/teachers/:teacherId')
  async unassign(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('courseId') courseId:string,@Param('teacherId') teacherId:string){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN']);
    await this.course(workspaceId,courseId);
    await prisma.courseTeacher.deleteMany({where:{courseId,teacherId,teacher:{workspaceId}}});
    return {courseId,teacherId,assigned:false};
  }

  @Post('courses/:courseId/topics')
  async createTopic(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('courseId') courseId:string,@Body() input:unknown){
    await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN','TEACHER']);
    await this.course(workspaceId,courseId);
    await this.canEdit(workspaceId,req.academyUser!.id,courseId);
    const parsed=topicInput.safeParse(input);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    if(parsed.data.parentId){
      const parent=await prisma.topic.findFirst({where:{id:parsed.data.parentId,courseId},select:{id:true}});
      if(!parent)throw new BadRequestException('Parent topic does not belong to this course');
    }
    return prisma.topic.create({
      data:{courseId,title:parsed.data.title,order:parsed.data.order,parentId:parsed.data.parentId||null},
      select:{id:true,courseId:true,title:true,parentId:true,order:true},
    });
  }
}
