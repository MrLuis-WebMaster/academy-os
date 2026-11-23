import type {MembershipPort} from '../../academics/application/ports.js';
import {
 parsePackagePlan,parsePackageIssue,parsePackageStatus,
 parsePackageId,parsePackageRedemption,parsePackageRevoke,
} from '../domain/class-package.js';
import type {ClassPackagesRepository} from './package-ports.js';

export class PackageAccessDenied extends Error{
 constructor(){super('You are not authorized to manage or use these class packages');this.name='PackageAccessDenied';}
}
export class PackageNotFound extends Error{
 constructor(){super('Package, entitlement or booking is not available in this academy');this.name='PackageNotFound';}
}
export class PackageConflict extends Error{
 constructor(message='This package is inactive, expired, or out of credits'){super(message);this.name='PackageConflict';}
}
export class ClassPackagesUseCases{
 constructor(private readonly repo:ClassPackagesRepository,private readonly members:MembershipPort){}
 private async allow(workspaceId:string,userId:string,student:boolean){
  if(!workspaceId||!userId||!await this.members.hasAnyRole(
   workspaceId,userId,student?['STUDENT']:['OWNER','ADMIN'],
  ))throw new PackageAccessDenied();
 }
 async plans(workspaceId:string,userId:string){
  await this.allow(workspaceId,userId,false);return this.repo.plans(workspaceId,userId);
 }
 async create(workspaceId:string,userId:string,raw:unknown){
  await this.allow(workspaceId,userId,false);
  return this.repo.create(workspaceId,userId,parsePackagePlan(raw));
 }
 async setActive(workspaceId:string,userId:string,packageId:unknown,raw:unknown){
  await this.allow(workspaceId,userId,false);
  return this.repo.setActive(workspaceId,userId,parsePackageId(packageId),parsePackageStatus(raw).active);
 }
 async issue(workspaceId:string,userId:string,packageId:unknown,raw:unknown){
  await this.allow(workspaceId,userId,false);
  return this.repo.issue(workspaceId,userId,parsePackageId(packageId),parsePackageIssue(raw));
 }
 async issuances(workspaceId:string,userId:string){
  await this.allow(workspaceId,userId,false);
  return this.repo.issuances(workspaceId,userId);
 }
 async revoke(workspaceId:string,userId:string,grantId:unknown,raw:unknown){
  await this.allow(workspaceId,userId,false);
  return this.repo.revoke(workspaceId,userId,parsePackageId(grantId),parsePackageRevoke(raw).reason);
 }
 async mine(workspaceId:string,userId:string){
  await this.allow(workspaceId,userId,true);return this.repo.mine(workspaceId,userId);
 }
 async redeem(workspaceId:string,userId:string,raw:unknown){
  await this.allow(workspaceId,userId,true);
  return this.repo.redeem(workspaceId,userId,parsePackageRedemption(raw));
 }
}
