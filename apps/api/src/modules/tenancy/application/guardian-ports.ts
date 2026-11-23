import type {GuardianApproval,GuardianLinkInput,GuardianRevoke} from '../domain/guardian-link.js';

export interface GuardianLinkView {
  id:string;guardianUserId:string;studentUserId:string;
  status:'PENDING'|'ACTIVE'|'REVOKED';approvedAt:Date|null;createdAt:Date;
  verificationMethod:string|null;
  guardian:{name:string;email:string};
  student:{name:string;email:string};
}
export interface GuardianStudent {
  id:string;studentUserId:string;student:{id:string;name:string};
}
export interface GuardianCourseOverview {
  courseId:string;title:string;subject:string;
  skills:Array<{topic:string;mastery:number;evidenceCount:number}>;
  goals:Array<{title:string;status:'ACTIVE'|'ACHIEVED'|'CANCELLED';targetMastery:number|null}>;
}
export interface GuardianOverview {
  student:{id:string;name:string};
  courses:GuardianCourseOverview[];
}
export interface GuardianRepository {
  links(workspaceId:string,actorId:string):Promise<GuardianLinkView[]>;
  start(workspaceId:string,actorId:string,input:GuardianLinkInput):Promise<{id:string;status:'PENDING'|'ACTIVE'}>;
  approve(workspaceId:string,actorId:string,linkId:string,input:GuardianApproval):Promise<{id:string;status:'ACTIVE';approvedAt:Date}>;
  revoke(workspaceId:string,actorId:string,linkId:string,input:GuardianRevoke):Promise<{id:string;status:'REVOKED'}>;
  students(workspaceId:string,actorId:string):Promise<GuardianStudent[]>;
  overview(workspaceId:string,actorId:string,studentId:string):Promise<GuardianOverview>;
}
