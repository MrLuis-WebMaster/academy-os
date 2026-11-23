import type {MembershipPort} from '../../academics/application/ports.js';
import {parseInvitation,parseInvitationToken} from '../domain/invitation.js';
import type {InvitationRepository,InvitationTokenPort} from './invitation-ports.js';

export class InvitationAccessDenied extends Error {
  constructor(){super('Only academy managers can issue invitations');this.name='InvitationAccessDenied';}
}
export class InvitationRoleDenied extends Error {
  constructor(){super('Only academy owners can invite new admins');this.name='InvitationRoleDenied';}
}
export class InvitationLimitReached extends Error {
  constructor(){super('Daily invitation limit reached');this.name='InvitationLimitReached';}
}
export class InvitationUnavailable extends Error {
  constructor(){super('Invitation expired or already used');this.name='InvitationUnavailable';}
}
export class InvitationWrongEmail extends Error {
  constructor(){super('Sign in using the invited email address');this.name='InvitationWrongEmail';}
}

export class InvitationUseCases {
  constructor(
    private readonly repository:InvitationRepository,
    private readonly members:MembershipPort,
    private readonly tokens:InvitationTokenPort,
  ){}
  async issue(workspaceId:string,actorId:string,raw:unknown){
    const {email,role}=parseInvitation(raw);
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN'])){
      throw new InvitationAccessDenied();
    }
    if(role==='ADMIN'&&!await this.members.hasAnyRole(workspaceId,actorId,['OWNER'])){
      throw new InvitationRoleDenied();
    }
    const {token,hash}=this.tokens.mint();
    const issued=await this.repository.issue(workspaceId,actorId,email,role,hash,new Date());
    return {...issued,token};
  }
  async accept(actorId:string,actorEmail:string,raw:unknown){
    if(!actorId||!actorEmail)throw new InvitationAccessDenied();
    const token=parseInvitationToken(raw);
    return this.repository.accept(this.tokens.digest(token),actorId,actorEmail.trim().toLowerCase(),new Date());
  }
}
