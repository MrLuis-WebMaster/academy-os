import type {SosReferralInput,SosResolution} from '../domain/sos-referral.js';
export interface SosReferralView{
 id:string;courseId:string;studentUserId:string;question:string;
 status:'OPEN'|'RESOLVED';reply:string|null;createdAt:Date;resolvedAt:Date|null;
 course:{title:string};
}
export interface StaffSosReferralView extends SosReferralView{
 student:{name:string};
}
export interface SosReferralRepository{
 send(workspaceId:string,actorId:string,input:SosReferralInput):Promise<SosReferralView>;
 mine(workspaceId:string,actorId:string):Promise<SosReferralView[]>;
 staff(workspaceId:string,actorId:string):Promise<StaffSosReferralView[]>;
 resolve(workspaceId:string,actorId:string,id:string,input:SosResolution):Promise<SosReferralView>;
}
