import {z} from 'zod';

const id=z.string().trim().min(1).max(128);
const packagePlanInput=z.object({
 title:z.string().trim().min(3).max(120),
 courseId:id.nullable().optional(),
 sessionCredits:z.number().int().min(1).max(200),
 priceCOP:z.number().int().min(0).max(500000000),
 validDays:z.number().int().min(1).max(365),
}).strict();
const packageIssueInput=z.object({
 studentUserId:id,
 requestId:z.string().uuid(),
 note:z.string().trim().max(280).optional(),
}).strict();
const packageStatusInput=z.object({active:z.boolean()}).strict();
const redemptionInput=z.object({entitlementId:id,bookingId:id}).strict();

export type PackagePlanInput=z.infer<typeof packagePlanInput>;
export type PackageIssueInput=z.infer<typeof packageIssueInput>;
export type PackageRedemptionInput=z.infer<typeof redemptionInput>;

export class InvalidPackageInput extends Error{
 constructor(readonly details:unknown){super('Invalid class package request');this.name='InvalidPackageInput';}
}
function parse<T>(schema:z.ZodType<T>,value:unknown):T{
 const parsed=schema.safeParse(value);
 if(!parsed.success)throw new InvalidPackageInput(parsed.error.flatten());
 return parsed.data;
}
export const parsePackagePlan=(raw:unknown):PackagePlanInput=>parse(packagePlanInput,raw);
export const parsePackageIssue=(raw:unknown):PackageIssueInput=>parse(packageIssueInput,raw);
export const parsePackageStatus=(raw:unknown)=>parse(packageStatusInput,raw);
export const parsePackageRedemption=(raw:unknown):PackageRedemptionInput=>parse(redemptionInput,raw);
export const parsePackageId=(raw:unknown)=>parse(id,raw);
export function grantExpiry(issuedAt:Date,validDays:number):Date{
 if(!Number.isFinite(issuedAt.getTime())||!Number.isInteger(validDays)||validDays<1||validDays>365){
  throw new InvalidPackageInput('Invalid issue date or validity');
 }
 return new Date(issuedAt.getTime()+validDays*86400000);
}
export function remainingCredits(credits:number,used:number):number{
 return Math.max(0,credits-used);
}
