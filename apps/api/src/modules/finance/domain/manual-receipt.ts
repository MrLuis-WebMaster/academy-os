import {z} from 'zod';

/** Manual receipts attest payments already received; this module never charges money. */
export const receiptInput=z.object({
  studentUserId:z.string().min(1),
  courseId:z.string().min(1).nullable().optional(),
  amountCOP:z.number().int().positive().max(500000000),
  method:z.enum(['CASH','BANK_TRANSFER','OTHER']),
  reference:z.string().trim().max(80).optional(),
});
export const voidReceiptInput=z.object({reason:z.string().trim().min(5).max(280)});

export type ReceiptCommand=z.infer<typeof receiptInput>;
export type ManualPaymentMethod=ReceiptCommand['method'];

export class InvalidReceiptInput extends Error {
  constructor(readonly details:unknown) {
    super('Invalid manual payment request');
    this.name='InvalidReceiptInput';
  }
}

export function parseReceipt(input:unknown):ReceiptCommand {
  const parsed=receiptInput.safeParse(input);
  if(!parsed.success)throw new InvalidReceiptInput(parsed.error.flatten());
  return parsed.data;
}

export function parseVoidReason(input:unknown):string {
  const parsed=voidReceiptInput.safeParse(input);
  if(!parsed.success)throw new InvalidReceiptInput(parsed.error.flatten());
  return parsed.data.reason;
}

export function parseReceiptId(input:unknown):string {
  if(typeof input!=='string'||!input.trim()||input.length>128){
    throw new InvalidReceiptInput('A valid receipt identifier is required');
  }
  return input.trim();
}
