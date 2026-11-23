import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {GuardianRepository} from '../application/guardian-ports.js';
import type {GuardianLinkInput,GuardianApproval,GuardianRevoke} from '../domain/guardian-link.js';
import {GuardianAccessDenied,GuardianLinkConflict,GuardianLinkNotFound} from '../application/guardian-use-cases.js';

export class PrismaGuardianRepository implements GuardianRepository {
  private async manager(tx:Prisma.TransactionClient,workspaceId:string,actorId:string){
    if(!await tx.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},select:{id:true},
    }))throw new GuardianAccessDenied();
  }
  private async membershipPair(
    tx:Prisma.TransactionClient,workspaceId:string,guardianUserId:string,studentUserId:string,
  ){
    const [guardian,student]=await Promise.all([
      tx.workspaceMember.findFirst({
        where:{workspaceId,userId:guardianUserId,role:'GUARDIAN'},select:{id:true},
      }),
      tx.workspaceMember.findFirst({
        where:{workspaceId,userId:studentUserId,role:'STUDENT'},select:{id:true},
      }),
    ]);
    if(!guardian||!student)throw new GuardianLinkNotFound();
  }
  private pairLock(workspaceId:string,guardianId:string,studentId:string){
    return 'academy-os:guardian:'+workspaceId+':'+guardianId+':'+studentId;
  }

  async links(workspaceId:string,actorId:string){
    if(!await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},select:{id:true},
    }))throw new GuardianAccessDenied();
    return prisma.guardianLink.findMany({
      where:{workspaceId},
      select:{
        id:true,guardianUserId:true,studentUserId:true,status:true,
        approvedAt:true,createdAt:true,verificationMethod:true,
        guardian:{select:{name:true,email:true}},
        student:{select:{name:true,email:true}},
      },
      take:250,orderBy:{createdAt:'desc'},
    });
  }

  async start(workspaceId:string,actorId:string,input:GuardianLinkInput){
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${this.pairLock(workspaceId,input.guardianUserId,input.studentUserId)}))::text AS lock_acquired`;
      await this.manager(tx,workspaceId,actorId);
      await this.membershipPair(tx,workspaceId,input.guardianUserId,input.studentUserId);
      const unique={workspaceId_guardianUserId_studentUserId:{
        workspaceId,guardianUserId:input.guardianUserId,studentUserId:input.studentUserId,
      }};
      const existing=await tx.guardianLink.findUnique({where:unique,select:{id:true,status:true}});
      if(existing?.status==='ACTIVE'||existing?.status==='PENDING')return existing;
      if(existing){
        const updated=await tx.guardianLink.update({
          where:{id:existing.id},
          data:{
            status:'PENDING',requestedByUserId:actorId,approvedByUserId:null,approvedAt:null,
            revokedAt:null,verificationMethod:null,verificationNote:null,
          },
          select:{id:true,status:true},
        });
        await tx.guardianLinkEvent.create({
          data:{
            linkId:updated.id,actorUserId:actorId,fromStatus:'REVOKED',
            toStatus:'PENDING',reason:'La academia solicitó una nueva revisión de la relación',
          },
        });
        return updated;
      }
      const newLink=await tx.guardianLink.create({
        data:{
          workspaceId,guardianUserId:input.guardianUserId,
          studentUserId:input.studentUserId,requestedByUserId:actorId,
        },
        select:{id:true,status:true},
      });
      await tx.guardianLinkEvent.create({
        data:{
          linkId:newLink.id,actorUserId:actorId,toStatus:'PENDING',
          reason:'Relación solicitada, pendiente de verificación manual',
        },
      });
      return newLink;
    });
  }

  async approve(workspaceId:string,actorId:string,linkId:string,input:GuardianApproval){
    const candidate=await prisma.guardianLink.findFirst({
      where:{id:linkId,workspaceId},
      select:{guardianUserId:true,studentUserId:true},
    });
    if(!candidate)throw new GuardianLinkNotFound();
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${this.pairLock(workspaceId,candidate.guardianUserId,candidate.studentUserId)}))::text AS lock_acquired`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:guardian-link:'+linkId}))::text AS lock_acquired`;
      await this.manager(tx,workspaceId,actorId);
      const link=await tx.guardianLink.findFirst({
        where:{workspaceId,id:linkId},
        select:{id:true,status:true,guardianUserId:true,studentUserId:true,approvedAt:true},
      });
      if(!link)throw new GuardianLinkNotFound();
      if(link.status==='ACTIVE'){
        return {id:link.id,status:'ACTIVE' as const,approvedAt:link.approvedAt!};
      }
      if(link.status!=='PENDING')throw new GuardianLinkConflict('A revoked relationship requires a new verification request');
      await this.membershipPair(tx,workspaceId,link.guardianUserId,link.studentUserId);
      const approvedAt=new Date();
      await tx.guardianLink.update({
        where:{id:link.id},
        data:{
          status:'ACTIVE',approvedByUserId:actorId,approvedAt,
          verificationMethod:input.method,verificationNote:input.verificationNote,
        },
      });
      await tx.guardianLinkEvent.create({
        data:{
          linkId:link.id,actorUserId:actorId,fromStatus:'PENDING',
          toStatus:'ACTIVE',reason:'Verificación manual confirmada: '+input.method,
        },
      });
      return {id:link.id,status:'ACTIVE' as const,approvedAt};
    });
  }

  async revoke(workspaceId:string,actorId:string,linkId:string,input:GuardianRevoke){
    const candidate=await prisma.guardianLink.findFirst({
      where:{id:linkId,workspaceId},
      select:{guardianUserId:true,studentUserId:true},
    });
    if(!candidate)throw new GuardianLinkNotFound();
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${this.pairLock(workspaceId,candidate.guardianUserId,candidate.studentUserId)}))::text AS lock_acquired`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:guardian-link:'+linkId}))::text AS lock_acquired`;
      const [members,link]=await Promise.all([
        tx.workspaceMember.findMany({
          where:{workspaceId,userId:actorId,
            role:{in:['OWNER','ADMIN','GUARDIAN','STUDENT']}},
          select:{role:true},
        }),
        tx.guardianLink.findFirst({
          where:{workspaceId,id:linkId},
          select:{id:true,status:true,guardianUserId:true,studentUserId:true},
        }),
      ]);
      if(!link)throw new GuardianLinkNotFound();
      const manager=members.some(m=>m.role==='OWNER'||m.role==='ADMIN');
      const guardian=members.some(m=>m.role==='GUARDIAN')&&actorId===link.guardianUserId;
      const student=members.some(m=>m.role==='STUDENT')&&actorId===link.studentUserId;
      if(!manager&&!guardian&&!student)throw new GuardianAccessDenied();
      if(link.status==='REVOKED')return {id:link.id,status:'REVOKED' as const};
      await tx.guardianLink.update({
        where:{id:link.id},
        data:{status:'REVOKED',revokedAt:new Date()},
      });
      await tx.guardianLinkEvent.create({
        data:{
          linkId:link.id,actorUserId:actorId,fromStatus:link.status,
          toStatus:'REVOKED',reason:input.reason,
        },
      });
      return {id:link.id,status:'REVOKED' as const};
    });
  }

  async students(workspaceId:string,actorId:string){
    if(!await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:'GUARDIAN'},select:{id:true},
    }))throw new GuardianAccessDenied();
    return prisma.guardianLink.findMany({
      where:{
        workspaceId,guardianUserId:actorId,status:'ACTIVE',
        student:{memberships:{some:{workspaceId,role:'STUDENT'}}},
      },
      select:{
        studentUserId:true,student:{select:{id:true,name:true}},
      },
      take:100,
    });
  }

  async overview(workspaceId:string,actorId:string,studentId:string){
    return prisma.$transaction(async tx=>{
      const relation=await tx.guardianLink.findFirst({
        where:{workspaceId,guardianUserId:actorId,studentUserId:studentId,status:'ACTIVE'},
        select:{id:true},
      });
      if(!relation)throw new GuardianLinkNotFound();
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:guardian-link:'+relation.id}))::text AS lock_acquired`;
      const [member,active,student]=await Promise.all([
        tx.workspaceMember.findFirst({
          where:{workspaceId,userId:actorId,role:'GUARDIAN'},select:{id:true},
        }),
        tx.guardianLink.findFirst({
          where:{workspaceId,id:relation.id,guardianUserId:actorId,studentUserId:studentId,status:'ACTIVE'},
          select:{id:true},
        }),
        tx.workspaceMember.findFirst({
          where:{workspaceId,userId:studentId,role:'STUDENT'},
          select:{user:{select:{id:true,name:true}}},
        }),
      ]);
      if(!member||!active||!student)throw new GuardianLinkNotFound();
      const enrollments=await tx.enrollment.findMany({
        where:{userId:studentId,course:{workspaceId}},
        select:{
          course:{select:{
            id:true,title:true,subject:{select:{name:true}},
          }},
        },
        take:100,
      });
      const ids=enrollments.map(item=>item.course.id);
      const [skills,goals]=await Promise.all([
        tx.skillProgress.findMany({
          where:{userId:studentId,topic:{courseId:{in:ids}}},
          select:{
            mastery:true,evidenceCount:true,
            topic:{select:{title:true,courseId:true}},
          },take:500,
        }),
        tx.learningGoal.findMany({
          where:{workspaceId,studentUserId:studentId,courseId:{in:ids}},
          select:{courseId:true,title:true,status:true,targetMastery:true},
          take:200,
        }),
      ]);
      // Deliberately omit contact data, evidence notes, teachers' raw notes,
      // meeting URLs, materials, answers, finance data and raw attendance records.
      return {
        student:student.user,
        courses:enrollments.map(({course})=>({
          courseId:course.id,title:course.title,subject:course.subject?.name??'General',
          skills:skills.filter(item=>item.topic.courseId===course.id).map(item=>({
            topic:item.topic.title,mastery:item.mastery,evidenceCount:item.evidenceCount,
          })),
          goals:goals.filter(goal=>goal.courseId===course.id).map(goal=>({
            title:goal.title,status:goal.status,targetMastery:goal.targetMastery,
          })),
        })),
      };
    });
  }
}
