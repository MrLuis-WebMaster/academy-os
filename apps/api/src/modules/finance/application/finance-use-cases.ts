import {parseReceipt,parseReceiptId,parseVoidReason} from '../domain/manual-receipt.js';
import type {MembershipPort} from '../../academics/application/ports.js';
import type {FinanceRepository} from './ports.js';

export class FinanceAccessDenied extends Error {
  constructor(){super('You cannot manage finances in this academy');this.name='FinanceAccessDenied';}
}
export class StudentOutsideWorkspace extends Error {
  constructor(){super('The student does not belong to this workspace');this.name='StudentOutsideWorkspace';}
}
export class CourseOutsideWorkspace extends Error {
  constructor(){super('Course does not belong to the workspace');this.name='CourseOutsideWorkspace';}
}
export class ActiveReceiptNotFound extends Error {
  constructor(){super('Active receipt not found');this.name='ActiveReceiptNotFound';}
}

/** Business actions independent of NestJS, Prisma and HTTP. */
export class FinanceUseCases {
  constructor(private readonly receipts:FinanceRepository,private readonly members:MembershipPort){}

  private async authorize(workspaceId:string,actorId:string,ownerOnly=false):Promise<void> {
    const roles=ownerOnly?(['OWNER'] as const):(['OWNER','ADMIN'] as const);
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,roles)){
      throw new FinanceAccessDenied();
    }
  }

  async list(workspaceId:string,actorId:string) {
    await this.authorize(workspaceId,actorId);
    return this.receipts.listReceipts(workspaceId);
  }

  async summary(workspaceId:string,actorId:string) {
    await this.authorize(workspaceId,actorId);
    return this.receipts.summarize(workspaceId);
  }

  async record(workspaceId:string,actorId:string,raw:unknown) {
    await this.authorize(workspaceId,actorId);
    const receipt=parseReceipt(raw);
    const [studentExists,courseExists]=await Promise.all([
      this.receipts.studentIsMember(workspaceId,receipt.studentUserId),
      receipt.courseId?this.receipts.courseBelongsToWorkspace(workspaceId,receipt.courseId):Promise.resolve(true),
    ]);
    if(!studentExists)throw new StudentOutsideWorkspace();
    if(!courseExists)throw new CourseOutsideWorkspace();
    return this.receipts.record({
      workspaceId,studentUserId:receipt.studentUserId,recordedByUserId:actorId,
      courseId:receipt.courseId??null,amountCOP:receipt.amountCOP,
      method:receipt.method,reference:receipt.reference,
    });
  }

  async voidReceipt(workspaceId:string,actorId:string,id:unknown,raw:unknown) {
    await this.authorize(workspaceId,actorId,true);
    const receiptId=parseReceiptId(id);
    const reason=parseVoidReason(raw);
    if(!await this.receipts.voidActive(workspaceId,receiptId,reason)){
      throw new ActiveReceiptNotFound();
    }
    return {id:receiptId,voided:true};
  }
}
