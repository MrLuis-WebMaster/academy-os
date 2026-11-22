import type {ManualPaymentMethod} from '../domain/manual-receipt.js';

export interface ManualReceiptView {
  id:string;
  amountCOP:number;
  method:ManualPaymentMethod;
  reference:string|null;
  receivedAt:Date;
  voidedAt:Date|null;
  voidReason:string|null;
  student:{name:string};
  course:{title:string}|null;
}

export interface ReceiptSummary {
  currency:'COP';
  totalReceivedCOP:number;
  receiptCount:number;
}

export interface RecordManualReceipt {
  workspaceId:string;
  studentUserId:string;
  recordedByUserId:string;
  courseId:string|null;
  amountCOP:number;
  method:ManualPaymentMethod;
  reference?:string;
}

export interface ManualReceiptCreated {
  id:string;
  amountCOP:number;
  method:ManualPaymentMethod;
  receivedAt:Date;
}

export interface FinanceRepository {
  listReceipts(workspaceId:string):Promise<ManualReceiptView[]>;
  summarize(workspaceId:string):Promise<ReceiptSummary>;
  studentIsMember(workspaceId:string,userId:string):Promise<boolean>;
  courseBelongsToWorkspace(workspaceId:string,courseId:string):Promise<boolean>;
  record(input:RecordManualReceipt):Promise<ManualReceiptCreated>;
  voidActive(workspaceId:string,receiptId:string,reason:string):Promise<boolean>;
}
