import {z} from 'zod';

export const receiptInput=z.object({
  studentUserId:z.string().min(1),
  courseId:z.string().min(1).nullable().optional(),
  amountCOP:z.number().int().positive().max(500000000),
  method:z.enum(['CASH','BANK_TRANSFER','OTHER']),
  reference:z.string().trim().max(80).optional(),
});
export const voidReceiptInput=z.object({reason:z.string().trim().min(5).max(280)});
