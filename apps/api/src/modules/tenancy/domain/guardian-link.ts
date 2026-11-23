import {z} from 'zod';

const id=z.string().trim().min(1).max(128);
export const guardianLinkInput=z.object({
  guardianUserId:id,
  studentUserId:id,
}).refine(input=>input.guardianUserId!==input.studentUserId,'Guardian and student must be different accounts');
export const guardianApprovalInput=z.object({
  verificationConfirmed:z.literal(true),
  method:z.enum(['IN_PERSON','OTHER_MANUAL_VERIFICATION']),
  verificationNote:z.string().trim().min(10).max(300),
});
export const guardianRevokeInput=z.object({
  reason:z.string().trim().min(5).max(300),
});
export type GuardianLinkInput=z.infer<typeof guardianLinkInput>;
export type GuardianApproval=z.infer<typeof guardianApprovalInput>;
export type GuardianRevoke=z.infer<typeof guardianRevokeInput>;
export class InvalidGuardianLink extends Error{
  constructor(readonly details:unknown){super('Invalid family relationship request');this.name='InvalidGuardianLink';}
}
function parse<T>(schema:z.ZodType<T>,raw:unknown):T{
  const result=schema.safeParse(raw);
  if(!result.success)throw new InvalidGuardianLink(result.error.flatten());
  return result.data;
}
export const parseGuardianLink=(raw:unknown)=>parse(guardianLinkInput,raw);
export const parseGuardianApproval=(raw:unknown)=>parse(guardianApprovalInput,raw);
export const parseGuardianRevoke=(raw:unknown)=>parse(guardianRevokeInput,raw);
export function parseGuardianId(raw:unknown){return parse(id,raw);}
