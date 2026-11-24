import {z} from 'zod';
const id=z.string().trim().min(1).max(128);
export class InvalidOrderInput extends Error{}
export class OrderDenied extends Error{}
export class OrderMissing extends Error{}
export class OrderConflict extends Error{}
export class OrdersDisabled extends Error{}
const createSchema=z.object({packageId:id,requestId:z.string().uuid(),expectedPriceCOP:z.number().int().positive().max(500000000)}).strict();
const reviewSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('fulfill'),paymentReference:z.string().trim().min(4).max(120).regex(/^[a-zA-Z0-9._:/-]+$/).transform(v=>v.toUpperCase()),amountCOP:z.number().int().positive().max(500000000),note:z.string().trim().min(6).max(300),confirmedExternalPayment:z.literal(true)}).strict(),
 z.object({action:z.literal('reject'),note:z.string().trim().min(6).max(300)}).strict(),
]);
function parse<T>(schema:z.ZodType<T>,raw:unknown):T{const result=schema.safeParse(raw);if(!result.success)throw new InvalidOrderInput('Invalid purchase request');return result.data;}
export type CreateOrder=z.infer<typeof createSchema>;
export type ReviewOrder=z.infer<typeof reviewSchema>;
export const parseCreateOrder=(raw:unknown)=>parse(createSchema,raw);
export const parseReviewOrder=(raw:unknown)=>parse(reviewSchema,raw);
export const parseOrderId=(raw:unknown)=>parse(id,raw);
