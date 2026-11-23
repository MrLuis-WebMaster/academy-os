import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {PracticeRepository,PracticeDraft,PracticeRevision} from '../application/practice-ports.js';
import {gradePractice,publicQuestions,questionSetSchema} from '../domain/practice.js';
import {
  PracticeAccessDenied,PracticeConflict,PracticeNotFound,PracticePrerequisiteMissing,
} from '../application/practice-use-cases.js';
import {InvalidPracticeInput} from '../domain/practice.js';

export class PrismaPracticeRepository implements PracticeRepository {
  private async teachingScope(tx:Prisma.TransactionClient,workspaceId:string,userId:string,sessionId:string){
    const [members,session]=await Promise.all([
      tx.workspaceMember.findMany({
        where:{workspaceId,userId,role:{in:['OWNER','ADMIN','TEACHER']}},select:{role:true},
      }),
      tx.classSession.findFirst({
        where:{workspaceId,id:sessionId,course:{workspaceId}},
        select:{id:true,teacherProfileId:true,teacher:{select:{userId:true}},reflection:{select:{id:true,status:true}}},
      }),
    ]);
    if(!members.length)throw new PracticeAccessDenied();
    if(!session)throw new PracticeNotFound('Course session not found');
    const manager=members.some(m=>m.role==='OWNER'||m.role==='ADMIN');
    if(!manager&&session.teacher?.userId!==userId)throw new PracticeAccessDenied();
    return session;
  }

  private async studentAccess(tx:Prisma.TransactionClient,workspaceId:string,userId:string){
    if(!await tx.workspaceMember.findFirst({
      where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
    }))throw new PracticeAccessDenied();
  }

  async create(workspaceId:string,actorId:string,draft:PracticeDraft){
    return prisma.$transaction(async tx=>{
      const session=await this.teachingScope(tx,workspaceId,actorId,draft.sessionId);
      if(!session.reflection)throw new PracticePrerequisiteMissing();
      return tx.activity.create({
        data:{reflectionId:session.reflection.id,title:draft.title,questions:draft.questions},
        select:{id:true,title:true,publishedAt:true},
      });
    });
  }

  async listTeacher(workspaceId:string,actorId:string){
    const members=await prisma.workspaceMember.findMany({
      where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
      select:{role:true},
    });
    if(!members.length)throw new PracticeAccessDenied();
    const manager=members.some(m=>m.role==='OWNER'||m.role==='ADMIN');
    return prisma.activity.findMany({
      where:{
        reflection:{session:{workspaceId,...(!manager?{teacher:{workspaceId,userId:actorId}}:{})}},
      },
      select:{
        id:true,title:true,questions:true,publishedAt:true,
        reflection:{select:{
          sessionId:true,status:true,
          session:{select:{title:true,courseId:true}},
        }},
        _count:{select:{attempts:true}},
      },
      take:100,
    });
  }

  async revise(workspaceId:string,actorId:string,activityId:string,draft:PracticeRevision){
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:activity:'+activityId}))::text AS lock_acquired`;
      const activity=await tx.activity.findFirst({
        where:{id:activityId,reflection:{session:{workspaceId}}},
        select:{
          id:true,publishedAt:true,reflection:{select:{sessionId:true}},
          _count:{select:{attempts:true}},
        },
      });
      if(!activity)throw new PracticeNotFound();
      await this.teachingScope(tx,workspaceId,actorId,activity.reflection.sessionId);
      if(activity.publishedAt||activity._count.attempts>0)throw new PracticeConflict();
      const changed=await tx.activity.updateMany({
        where:{id:activityId,publishedAt:null},
        data:{title:draft.title,questions:draft.questions},
      });
      if(changed.count!==1)throw new PracticeConflict('Exercise changed during editing');
      return tx.activity.findUniqueOrThrow({
        where:{id:activityId},
        select:{id:true,title:true,questions:true,publishedAt:true},
      });
    });
  }

  async publish(workspaceId:string,actorId:string,activityId:string){
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:activity:'+activityId}))::text AS lock_acquired`;
      const activity=await tx.activity.findFirst({
        where:{id:activityId,reflection:{session:{workspaceId}}},
        select:{
          id:true,publishedAt:true,questions:true,
          reflection:{select:{sessionId:true,status:true}},
        },
      });
      if(!activity)throw new PracticeNotFound();
      await this.teachingScope(tx,workspaceId,actorId,activity.reflection.sessionId);
      if(activity.reflection.status!=='PUBLISHED')throw new PracticeConflict('Publish Class Alive notes first');
      if(!questionSetSchema.safeParse(activity.questions).success){
        throw new PracticeConflict('Invalid activity');
      }
      if(activity.publishedAt)return {id:activity.id,publishedAt:activity.publishedAt};
      await tx.activity.updateMany({
        where:{id:activity.id,publishedAt:null},data:{publishedAt:new Date()},
      });
      return tx.activity.findUniqueOrThrow({
        where:{id:activity.id},select:{id:true,publishedAt:true},
      });
    });
  }

  async listStudent(workspaceId:string,actorId:string){
    const isStudent=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:'STUDENT'},select:{id:true},
    });
    if(!isStudent)throw new PracticeAccessDenied();
    const activities=await prisma.activity.findMany({
      where:{
        publishedAt:{not:null},reflection:{
          status:'PUBLISHED',session:{
            workspaceId,course:{workspaceId,enrollments:{some:{userId:actorId}}},
          },
        },
      },
      select:{
        id:true,title:true,questions:true,publishedAt:true,
        reflection:{select:{session:{select:{courseId:true,title:true}}}},
        attempts:{
          where:{userId:actorId},
          select:{id:true,score:true,createdAt:true},
          orderBy:{createdAt:'desc'},take:1,
        },
      },
      take:100,
    });
    return activities.flatMap(a=>{
      const parsed=questionSetSchema.safeParse(a.questions);
      return parsed.success?[{
        id:a.id,title:a.title,questions:publicQuestions(parsed.data),
        courseId:a.reflection.session.courseId,
        sessionTitle:a.reflection.session.title,lastAttempt:a.attempts[0]??null,
      }]:[];
    });
  }

  async submit(workspaceId:string,actorId:string,activityId:string,answers:number[]){
    return prisma.$transaction(async tx=>{
      // Serializing edits/publish/attempts on the activity first avoids answer-key races.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:activity:'+activityId}))::text AS lock_acquired`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:attempt:'+actorId+':'+activityId}))::text AS lock_acquired`;
      await this.studentAccess(tx,workspaceId,actorId);
      const activity=await tx.activity.findFirst({
        where:{
          id:activityId,publishedAt:{not:null},
          reflection:{status:'PUBLISHED',session:{
            workspaceId,course:{workspaceId,enrollments:{some:{userId:actorId}}},
          }},
        },
        select:{id:true,questions:true},
      });
      if(!activity)throw new PracticeNotFound('Published activity unavailable to this student');
      const questions=questionSetSchema.safeParse(activity.questions);
      if(!questions.success)throw new PracticeConflict('Activity cannot be graded');
      if(answers.length!==questions.data.length)throw new InvalidPracticeInput('Answer count mismatch');
      const count=await tx.activityAttempt.count({where:{activityId,userId:actorId}});
      if(count>=3)throw new PracticeConflict('Maximum of three attempts per activity');
      const grade=gradePractice(questions.data,answers);
      const saved=await tx.activityAttempt.create({
        data:{activityId,userId:actorId,answers,score:grade.score},
        select:{id:true,createdAt:true},
      });
      return {...saved,...grade,attemptNumber:count+1};
    });
  }

  async passport(workspaceId:string,actorId:string){
    const student=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:'STUDENT'},select:{id:true},
    });
    if(!student)throw new PracticeAccessDenied();
    const [enrollments,attempts]=await Promise.all([
      prisma.enrollment.findMany({
        where:{userId:actorId,course:{workspaceId}},
        select:{course:{select:{id:true,title:true,subject:{select:{name:true}}}}},
      }),
      prisma.activityAttempt.findMany({
        where:{
          userId:actorId,activity:{
            publishedAt:{not:null},reflection:{status:'PUBLISHED',session:{
              workspaceId,course:{workspaceId,enrollments:{some:{userId:actorId}}},
            }},
          },
        },
        select:{
          score:true,createdAt:true,
          activity:{select:{reflection:{select:{session:{select:{courseId:true}}}}}},
        },
        orderBy:{createdAt:'desc'},take:500,
      }),
    ]);
    return enrollments.map(enrollment=>{
      const scores=attempts.filter(a=>
        a.activity.reflection.session.courseId===enrollment.course.id&&a.score!==null,
      );
      const average=scores.length
        ?Math.round(scores.reduce((sum,a)=>sum+(a.score??0),0)/scores.length):null;
      return {
        courseId:enrollment.course.id,title:enrollment.course.title,
        subject:enrollment.course.subject?.name??'Curso',
        attempts:scores.length,averageScore:average,
        metric:'Resultado promedio de prácticas realizadas',
      };
    });
  }
}
