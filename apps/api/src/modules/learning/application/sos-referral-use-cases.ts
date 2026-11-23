import type {MembershipPort} from '../../academics/application/ports.js';
import {parseSosReferral,parseSosResolution,parseSosReferralId} from '../domain/sos-referral.js';
import type {SosReferralRepository} from './sos-referral-ports.js';

export class SosReferralDenied extends Error{
 constructor(){super('You cannot access these questions in this academy');this.name='SosReferralDenied';}
}
export class SosReferralNotFound extends Error{
 constructor(){super('Question is not available in this academy');this.name='SosReferralNotFound';}
}
export class SosReferralLimitReached extends Error{
 constructor(){super('You have three unanswered questions in this course. Please wait for your teacher.');this.name='SosReferralLimitReached';}
}
export class SosReferralUseCases{
 constructor(private readonly repo:SosReferralRepository,private readonly membership:MembershipPort){}
 private async allow(workspaceId:string,userId:string,student:boolean){
  if(!workspaceId||!userId||!await this.membership.hasAnyRole(
   workspaceId,userId,student?['STUDENT']:['OWNER','ADMIN','TEACHER'],
  ))throw new SosReferralDenied();
 }
 async send(workspaceId:string,userId:string,raw:unknown){
  await this.allow(workspaceId,userId,true);
  return this.repo.send(workspaceId,userId,parseSosReferral(raw));
 }
 async mine(workspaceId:string,userId:string){
  await this.allow(workspaceId,userId,true);
  return this.repo.mine(workspaceId,userId);
 }
 async staff(workspaceId:string,userId:string){
  await this.allow(workspaceId,userId,false);
  return this.repo.staff(workspaceId,userId);
 }
 async resolve(workspaceId:string,userId:string,id:unknown,raw:unknown){
  await this.allow(workspaceId,userId,false);
  return this.repo.resolve(workspaceId,userId,parseSosReferralId(id),parseSosResolution(raw));
 }
}
