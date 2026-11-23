import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {
  StudentProgressRepository,LearningGoalRow,
} from '../application/student-progress-ports.js';
import type {EvidenceInput,GoalInput,GoalStatusInput} from '../domain/student-progress.js';
import {
  ProgressAccessDenied,ProgressConflict,ProgressResourceMissing,
} from '../application/student-progress-use-cases.js';

/** Assessments are human-entered and append-only, with one idempotency key per reviewer. */
export class PrismaStudentProgressRepository implements StudentProgressRepository {
  private async courseScope(
    tx:Prisma.TransactionClient,workspaceId:string,actorId:string,courseId:string,
  ) {
    const [members,course]=await Promise.all([
      tx.workspaceMember.findMany({
        where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN','TEACHER']}},
        select:{role:true},
      }),
      tx.course.findFirst({where:{id:courseId,workspaceId},select:{id:true}}),
    ]);
    if(!members.length)throw new ProgressAccessDenied();
    if(!course)throw new ProgressResourceMissing();
    if(!members.some(m=>m.role==='OWNER'||m.role==='ADMIN')){
      const assigned=await tx.courseTeacher.findFirst({
        where:{courseId,teacher:{workspaceId,userId:actorId}},select:{teacherId:true},
      });
      if(!assigned)throw new ProgressAccessDenied();
    }
  }
  private async enrolledStudent(
    tx:Prisma.TransactionClient,workspaceId:string,courseId:string,userId:string,
  ){
    const [student,enrolled]=await Promise.all([
      tx.workspaceMember.findFirst({
        where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
      }),
      tx.enrollment.findFirst({
        where:{courseId,userId,course:{workspaceId}},select:{id:true},
      }),
    ]);
    if(!student||!enrolled)throw new ProgressResourceMissing();
  }

  async student(workspaceId:string,userId:string){
    const student=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
    });
    if(!student)throw new ProgressAccessDenied();
    const [skills,goals]=await Promise.all([
      prisma.skillProgress.findMany({
        where:{
          userId,topic:{course:{workspaceId,enrollments:{some:{userId}}}},
        },
        select:{
          topicId:true,mastery:true,evidenceCount:true,
          topic:{select:{title:true,courseId:true,course:{select:{title:true}}}},
        },
        orderBy:{updatedAt:'desc'},take:500,
      }),
      prisma.learningGoal.findMany({
        where:{
          workspaceId,studentUserId:userId,
          course:{workspaceId,enrollments:{some:{userId}}},
        },
        select:{
          id:true,courseId:true,topicId:true,studentUserId:true,title:true,
          description:true,targetMastery:true,targetAt:true,status:true,
          createdAt:true,completedAt:true,
          course:{select:{title:true}},topic:{select:{title:true}},
        },
        orderBy:{createdAt:'desc'},take:150,
      }),
    ]);
    return {skills,goals};
  }

  async course(workspaceId:string,actorId:string,courseId:string){
    return prisma.$transaction(async tx=>{
      await this.courseScope(tx,workspaceId,actorId,courseId);
      const [topics,enrollments]=await Promise.all([
        tx.topic.findMany({
          where:{courseId},select:{id:true,title:true,order:true},orderBy:[{order:'asc'},{title:'asc'}],
          take:300,
        }),
        tx.enrollment.findMany({
          where:{courseId,course:{workspaceId}},
          select:{student:{select:{id:true,name:true}}},
          take:200,
        }),
      ]);
      const topicIds=topics.map(t=>t.id),studentIds=enrollments.map(e=>e.student.id);
      const [progress,goals]=await Promise.all([
        tx.skillProgress.findMany({
          where:{topicId:{in:topicIds},userId:{in:studentIds}},
          select:{topicId:true,userId:true,mastery:true,evidenceCount:true},
        }),
        tx.learningGoal.findMany({
          where:{workspaceId,courseId,studentUserId:{in:studentIds}},
          select:{
            id:true,courseId:true,topicId:true,studentUserId:true,title:true,
            description:true,targetMastery:true,targetAt:true,status:true,
            createdAt:true,completedAt:true,
          },
          take:1000,orderBy:{createdAt:'desc'},
        }),
      ]);
      return {
        courseId,topics,
        students:enrollments.map(({student})=>({
          id:student.id,name:student.name,
          skills:progress.filter(item=>item.userId===student.id).map(item=>({
            topicId:item.topicId,mastery:item.mastery,evidenceCount:item.evidenceCount,
          })),
          goals:goals.filter(goal=>goal.studentUserId===student.id),
        })),
      };
    });
  }

  async evidence(workspaceId:string,actorId:string,input:EvidenceInput){
    return prisma.$transaction(async tx=>{
      const topic=await tx.topic.findFirst({
        where:{id:input.topicId,course:{workspaceId}},
        select:{id:true,courseId:true},
      });
      if(!topic)throw new ProgressResourceMissing();
      await this.courseScope(tx,workspaceId,actorId,topic.courseId);
      // All reviewers serialize on the student/topic pair to compute the same aggregate.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:skill:'+input.topicId+':'+input.studentUserId}))::text AS lock_acquired`;
      await this.enrolledStudent(tx,workspaceId,topic.courseId,input.studentUserId);
      const unique={workspaceId_reviewerUserId_requestId:{
        workspaceId,reviewerUserId:actorId,requestId:input.requestId,
      }};
      const prior=await tx.skillEvidence.findUnique({where:unique});
      if(prior&&(prior.topicId!==input.topicId||prior.studentUserId!==input.studentUserId
        ||prior.score!==input.score||prior.note!==input.note)){
        throw new ProgressConflict('Request identifier was reused for different evidence');
      }
      const record=prior??await tx.skillEvidence.create({
        data:{
          workspaceId,topicId:input.topicId,studentUserId:input.studentUserId,
          reviewerUserId:actorId,requestId:input.requestId,score:input.score,note:input.note,
        },
      });
      const average=await tx.skillEvidence.aggregate({
        where:{topicId:input.topicId,studentUserId:input.studentUserId},
        _avg:{score:true},_count:{_all:true},
      });
      const mastery=Math.round(average._avg.score??0),evidenceCount=average._count._all;
      await tx.skillProgress.upsert({
        where:{topicId_userId:{topicId:input.topicId,userId:input.studentUserId}},
        create:{topicId:input.topicId,userId:input.studentUserId,mastery,evidenceCount},
        update:{mastery,evidenceCount},
      });
      return {
        id:record.id,topicId:record.topicId,studentUserId:record.studentUserId,
        score:record.score,note:record.note,createdAt:record.createdAt,mastery,evidenceCount,
      };
    },{timeout:20000});
  }

  async evidenceHistory(workspaceId:string,actorId:string,topicId:string,studentId:string){
    const topic=await prisma.topic.findFirst({
      where:{id:topicId,course:{workspaceId}},select:{courseId:true},
    });
    if(!topic)throw new ProgressResourceMissing();
    await prisma.$transaction(async tx=>{
      await this.courseScope(tx,workspaceId,actorId,topic.courseId);
      await this.enrolledStudent(tx,workspaceId,topic.courseId,studentId);
    });
    return prisma.skillEvidence.findMany({
      where:{workspaceId,topicId,studentUserId:studentId},
      select:{
        id:true,score:true,note:true,createdAt:true,
        reviewer:{select:{name:true}},
      },
      orderBy:{createdAt:'desc'},take:100,
    });
  }

  async createGoal(workspaceId:string,actorId:string,input:GoalInput){
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:goals:'+input.courseId+':'+input.studentUserId}))::text AS lock_acquired`;
      await this.courseScope(tx,workspaceId,actorId,input.courseId);
      await this.enrolledStudent(tx,workspaceId,input.courseId,input.studentUserId);
      if(input.topicId&&!await tx.topic.findFirst({
        where:{id:input.topicId,courseId:input.courseId},select:{id:true},
      }))throw new ProgressResourceMissing();
      const active=await tx.learningGoal.count({
        where:{workspaceId,courseId:input.courseId,studentUserId:input.studentUserId,status:'ACTIVE'},
      });
      if(active>=20)throw new ProgressConflict('Maximum 20 active goals per course and student');
      const goal=await tx.learningGoal.create({
        data:{
          workspaceId,courseId:input.courseId,topicId:input.topicId??null,
          studentUserId:input.studentUserId,assignedByUserId:actorId,
          title:input.title,description:input.description??null,
          targetMastery:input.targetMastery??null,
          targetAt:input.targetAt?new Date(input.targetAt):null,
        },
        select:{
          id:true,courseId:true,topicId:true,studentUserId:true,title:true,
          description:true,targetMastery:true,targetAt:true,status:true,
          createdAt:true,completedAt:true,
        },
      });
      return goal;
    });
  }

  async changeGoal(workspaceId:string,actorId:string,goalId:string,input:GoalStatusInput){
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:goal:'+goalId}))::text AS lock_acquired`;
      const current=await tx.learningGoal.findFirst({
        where:{id:goalId,workspaceId},
        select:{
          id:true,courseId:true,topicId:true,studentUserId:true,title:true,
          description:true,targetMastery:true,targetAt:true,status:true,
          createdAt:true,completedAt:true,
        },
      });
      if(!current)throw new ProgressResourceMissing();
      await this.courseScope(tx,workspaceId,actorId,current.courseId);
      if(current.status===input.status)return current; // idempotent retry.
      if(current.status!=='ACTIVE')throw new ProgressConflict('A completed or cancelled goal cannot be reopened');
      const updated=await tx.learningGoal.update({
        where:{id:goalId},
        data:{
          status:input.status,
          completedAt:input.status==='ACHIEVED'?new Date():null,
        },
        select:{
          id:true,courseId:true,topicId:true,studentUserId:true,title:true,
          description:true,targetMastery:true,targetAt:true,status:true,
          createdAt:true,completedAt:true,
        },
      });
      await tx.learningGoalEvent.create({
        data:{
          goalId,actorUserId:actorId,fromStatus:'ACTIVE',
          toStatus:input.status,reason:input.reason,
        },
      });
      return updated;
    });
  }
}
