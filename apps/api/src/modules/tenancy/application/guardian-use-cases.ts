import type {MembershipPort} from '../../academics/application/ports.js';
import {
  parseGuardianLink,parseGuardianApproval,parseGuardianRevoke,parseGuardianId,
} from '../domain/guardian-link.js';
import type {GuardianRepository} from './guardian-ports.js';

export class GuardianAccessDenied extends Error {
  constructor(){super('You are not authorized to manage or view this family relationship');this.name='GuardianAccessDenied';}
}
export class GuardianLinkNotFound extends Error {
  constructor(){super('Family relationship not found in this academy');this.name='GuardianLinkNotFound';}
}
export class GuardianLinkConflict extends Error {
  constructor(message='The family relationship cannot be changed in its current state'){
    super(message);this.name='GuardianLinkConflict';
  }
}
export class GuardianUseCases {
  constructor(private readonly repo:GuardianRepository,private readonly member:MembershipPort){}
  private async check(workspaceId:string,userId:string,roles:readonly ('OWNER'|'ADMIN'|'GUARDIAN')[]){
    if(!workspaceId||!userId||!await this.member.hasAnyRole(workspaceId,userId,roles)){
      throw new GuardianAccessDenied();
    }
  }
  async links(workspaceId:string,userId:string){
    await this.check(workspaceId,userId,['OWNER','ADMIN']);
    return this.repo.links(workspaceId,userId);
  }
  async start(workspaceId:string,userId:string,raw:unknown){
    await this.check(workspaceId,userId,['OWNER','ADMIN']);
    return this.repo.start(workspaceId,userId,parseGuardianLink(raw));
  }
  async approve(workspaceId:string,userId:string,linkId:unknown,raw:unknown){
    await this.check(workspaceId,userId,['OWNER','ADMIN']);
    return this.repo.approve(workspaceId,userId,parseGuardianId(linkId),parseGuardianApproval(raw));
  }
  async revoke(workspaceId:string,userId:string,linkId:unknown,raw:unknown){
    // The guardian or academy admin can revoke. The student owner is checked in storage too.
    if(!workspaceId||!userId)throw new GuardianAccessDenied();
    return this.repo.revoke(workspaceId,userId,parseGuardianId(linkId),parseGuardianRevoke(raw));
  }
  async students(workspaceId:string,userId:string){
    await this.check(workspaceId,userId,['GUARDIAN']);
    return this.repo.students(workspaceId,userId);
  }
  async overview(workspaceId:string,userId:string,studentId:unknown){
    await this.check(workspaceId,userId,['GUARDIAN']);
    return this.repo.overview(workspaceId,userId,parseGuardianId(studentId));
  }
}
