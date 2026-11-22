import {BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,NotFoundException,Param,Post,Req} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {requireMembership} from '../workspaces/access.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';
import {attemptSchema,gradePractice,newPracticeSchema,publicQuestions,questionSetSchema} from './practice.js';

@Controller('workspaces/:workspaceId/practice')
export class PracticeController {
  private async teachingScope(workspaceId:string,userId:string,sessionId:string) {
    const member=await requireMembership(workspaceId,userId,['OWNER','ADMIN','TEACHER']);
    const session=await prisma.classSession.findFirst({
      where:{id:sessionId,workspaceId},
      select:{id:true,courseId:true,teacherProfileId:true,reflection:{select:{id:true,status:true}}},
    });
    if(!session||!session.courseId)throw new NotFoundException('Course session not found');
    if(member.role==='TEACHER'){
      const teacher=await prisma.teacherProfile.findFirst({where:{workspaceId,userId},select:{id:true}});
      if(!teacher||teacher.id!==session.teacherProfileId)throw new ForbiddenException('Only the assigned teacher can edit this activity');
    }
    return session;
  }

  @Post()
  async create(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Body() input:unknown){
    const parsed=newPracticeSchema.safeParse(input);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    const session=await this.teachingScope(workspaceId,req.academyUser!.id,parsed.data.sessionId);
    if(!session.reflection)throw new BadRequestException('Save a Class Alive reflection before creating activities');
    return prisma.activity.create({
      data:{reflectionId:session.reflection.id,title:parsed.data.title,questions:parsed.data.questions},
      select:{id:true,title:true,publishedAt:true},
    });
  }

  @Get('teacher')
  async teacher(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    const member=await requireMembership(workspaceId,req.academyUser!.id,['OWNER','ADMIN','TEACHER']);
    const scoped=member.role==='TEACHER'?{teacher:{userId:req.academyUser!.id}}:{};
    return prisma.activity.findMany({
      where:{reflection:{session:{workspaceId,...scoped}}},
      select:{id:true,title:true,publishedAt:true,reflection:{select:{sessionId:true,session:{select:{title:true,courseId:true}}}},_count:{select:{attempts:true}}},
      take:100,
    });
  }

  @Post(':activityId/publish')
  async publish(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('activityId') activityId:string){
    const activity=await prisma.activity.findFirst({
      where:{id:activityId,reflection:{session:{workspaceId}}},
      select:{id:true,publishedAt:true,questions:true,reflection:{select:{sessionId:true,status:true}}},
    });
    if(!activity)throw new NotFoundException('Activity not found');
    await this.teachingScope(workspaceId,req.academyUser!.id,activity.reflection.sessionId);
    if(activity.reflection.status!=='PUBLISHED')throw new ConflictException('Publish Class Alive notes first');
    if(!questionSetSchema.safeParse(activity.questions).success)throw new ConflictException('Invalid activity');
    if(activity.publishedAt)return {id:activity.id,publishedAt:activity.publishedAt};
    await prisma.activity.updateMany({where:{id:activity.id,publishedAt:null},data:{publishedAt:new Date()}});
    return prisma.activity.findUnique({where:{id:activity.id},select:{id:true,publishedAt:true}});
  }

  @Get('student')
  async student(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    const userId=req.academyUser!.id;
    await requireMembership(workspaceId,userId,['STUDENT']);
    const activities=await prisma.activity.findMany({
      where:{publishedAt:{not:null},reflection:{status:'PUBLISHED',session:{workspaceId,course:{enrollments:{some:{userId}}}}}},
      select:{
        id:true,title:true,questions:true,publishedAt:true,
        reflection:{select:{session:{select:{courseId:true,title:true}}}},
        attempts:{where:{userId},select:{id:true,score:true,createdAt:true},orderBy:{createdAt:'desc'},take:1},
      },
      take:100,
    });
    return activities.flatMap(a=>{
      const parsed=questionSetSchema.safeParse(a.questions);
      return parsed.success?[{
        id:a.id,title:a.title,questions:publicQuestions(parsed.data),
        courseId:a.reflection.session.courseId,sessionTitle:a.reflection.session.title,
        lastAttempt:a.attempts[0]??null,
      }]:[];
    });
  }

  @Post(':activityId/attempts')
  async submit(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string,@Param('activityId') activityId:string,@Body() body:unknown){
    const userId=req.academyUser!.id;
    await requireMembership(workspaceId,userId,['STUDENT']);
    const parsed=attemptSchema.safeParse(body);
    if(!parsed.success)throw new BadRequestException(parsed.error.flatten());
    return prisma.$transaction(async tx=>{
      // $1 is a bound parameter, not interpolated SQL.
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))','academy-os:attempt:'+userId+':'+activityId);
      const activity=await tx.activity.findFirst({
        where:{id:activityId,publishedAt:{not:null},reflection:{status:'PUBLISHED',session:{workspaceId,course:{enrollments:{some:{userId}}}}}},
        select:{id:true,questions:true},
      });
      if(!activity)throw new NotFoundException('Published activity unavailable to this student');
      const set=questionSetSchema.safeParse(activity.questions);
      if(!set.success)throw new ConflictException('Activity cannot be graded');
      if(parsed.data.answers.length!==set.data.length)throw new BadRequestException('Answer count mismatch');
      const count=await tx.activityAttempt.count({where:{activityId,userId}});
      if(count>=3)throw new ConflictException('Maximum of three attempts per activity');
      const score=gradePractice(set.data,parsed.data.answers);
      const saved=await tx.activityAttempt.create({data:{activityId,userId,answers:parsed.data.answers,score:score.score},select:{id:true,createdAt:true}});
      return {...saved,...score,attemptNumber:count+1};
    });
  }

  @Get('passport')
  async passport(@Req() req:AuthenticatedRequest,@Param('workspaceId') workspaceId:string){
    const userId=req.academyUser!.id;
    await requireMembership(workspaceId,userId,['STUDENT']);
    const [enrollments,attempts]=await Promise.all([
      prisma.enrollment.findMany({where:{userId,course:{workspaceId}},select:{course:{select:{id:true,title:true,subject:{select:{name:true}}}}}}),
      prisma.activityAttempt.findMany({
        where:{userId,activity:{publishedAt:{not:null},reflection:{session:{workspaceId,course:{enrollments:{some:{userId}}}}}}},
        select:{score:true,createdAt:true,activity:{select:{reflection:{select:{session:{select:{courseId:true}}}}}}},
        orderBy:{createdAt:'desc'},take:500,
      }),
    ]);
    return enrollments.map(enrollment=>{
      const scores=attempts.filter(a=>a.activity.reflection.session.courseId===enrollment.course.id&&a.score!==null);
      const average=scores.length?Math.round(scores.reduce((sum,a)=>sum+(a.score??0),0)/scores.length):null;
      return {
        courseId:enrollment.course.id,title:enrollment.course.title,subject:enrollment.course.subject?.name??'Curso',
        attempts:scores.length,averageScore:average,metric:'Resultado promedio de prácticas realizadas',
      };
    });
  }
}
