import {z} from 'zod';

export const invitationRoleSchema=z.enum(['TEACHER','STUDENT','ADMIN','GUARDIAN']);
export type InvitationRole=z.infer<typeof invitationRoleSchema>;
export const inviteInput=z.object({
  email:z.email().max(255).transform(email=>email.trim().toLowerCase()),
  role:invitationRoleSchema,
});
export const acceptInvitationInput=z.object({
  token:z.string().trim().min(40).max(100),
});
export class InvalidInvitation extends Error {
  constructor(){super('Invalid invitation');this.name='InvalidInvitation';}
}
export function parseInvitation(raw:unknown):z.infer<typeof inviteInput>{
  const parsed=inviteInput.safeParse(raw);
  if(!parsed.success)throw new InvalidInvitation();
  return parsed.data;
}
export function parseInvitationToken(raw:unknown):string {
  const parsed=acceptInvitationInput.safeParse(raw);
  if(!parsed.success)throw new InvalidInvitation();
  return parsed.data.token;
}
export function allowedInvitationRole(raw:string):InvitationRole {
  const parsed=invitationRoleSchema.safeParse(raw);
  if(!parsed.success)throw new InvalidInvitation();
  return parsed.data;
}
