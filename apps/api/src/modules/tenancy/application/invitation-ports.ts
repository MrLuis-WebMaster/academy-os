import type {InvitationRole} from '../domain/invitation.js';

export interface InvitationTokenPort {
  mint():{token:string;hash:string};
  digest(token:string):string;
}
export interface IssuedInvitation {
  id:string;email:string;role:InvitationRole;expiresAt:Date;
}
export interface AcceptedInvitation {
  workspaceId:string;role:InvitationRole;
}
export interface InvitationRepository {
  /** Atomically revalidates actor role and counts daily invitations before insert. */
  issue(
    workspaceId:string,actorId:string,recipient:string,role:InvitationRole,tokenHash:string,
    now:Date,
  ):Promise<IssuedInvitation>;
  /** Locks the token and rechecks used/expired state and invited email. */
  accept(tokenHash:string,userId:string,normalizedEmail:string,now:Date):Promise<AcceptedInvitation>;
}
