import {prisma} from '../../../lib/prisma.js';
import type {FinanceRepository,RecordManualReceipt} from '../application/ports.js';
import {CourseOutsideWorkspace,StudentOutsideWorkspace} from '../application/finance-use-cases.js';

export class PrismaFinanceRepository implements FinanceRepository {
  async listReceipts(workspaceId:string) {
    return prisma.paymentReceipt.findMany({
      where:{workspaceId},
      select:{
        id:true,amountCOP:true,method:true,reference:true,receivedAt:true,
        voidedAt:true,voidReason:true,student:{select:{name:true}},course:{select:{title:true}},
      },
      take:300,orderBy:{receivedAt:'desc'},
    });
  }

  async summarize(workspaceId:string) {
    const result=await prisma.paymentReceipt.aggregate({
      where:{workspaceId,voidedAt:null},_sum:{amountCOP:true},_count:{id:true},
    });
    return {currency:'COP' as const,totalReceivedCOP:result._sum.amountCOP??0,receiptCount:result._count.id};
  }

  async studentIsMember(workspaceId:string,userId:string) {
    return Boolean(await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId,role:'STUDENT'},select:{id:true},
    }));
  }

  async courseBelongsToWorkspace(workspaceId:string,courseId:string) {
    return Boolean(await prisma.course.findFirst({where:{id:courseId,workspaceId},select:{id:true}}));
  }

  async record(input:RecordManualReceipt) {
    // Revalidate tenant ownership inside the same transaction as the write.
    // A client cannot attach another academy's student or course by guessing an ID.
    return prisma.$transaction(async tx=>{
      const [student,course]=await Promise.all([
        tx.workspaceMember.findFirst({
          where:{workspaceId:input.workspaceId,userId:input.studentUserId,role:'STUDENT'},
          select:{id:true},
        }),
        input.courseId?tx.course.findFirst({
          where:{id:input.courseId,workspaceId:input.workspaceId},select:{id:true},
        }):Promise.resolve({id:'none'}),
      ]);
      if(!student)throw new StudentOutsideWorkspace();
      if(!course)throw new CourseOutsideWorkspace();
      return tx.paymentReceipt.create({
        data:{
          workspaceId:input.workspaceId,studentUserId:input.studentUserId,
          recordedByUserId:input.recordedByUserId,courseId:input.courseId,
          amountCOP:input.amountCOP,method:input.method,reference:input.reference,
        },
        select:{id:true,amountCOP:true,method:true,receivedAt:true},
      });
    });
  }

  async voidActive(workspaceId:string,receiptId:string,reason:string) {
    const result=await prisma.paymentReceipt.updateMany({
      where:{id:receiptId,workspaceId,voidedAt:null},
      data:{voidedAt:new Date(),voidReason:reason},
    });
    return result.count===1;
  }
}
