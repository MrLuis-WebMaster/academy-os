import type {PackageIssueInput,PackagePlanInput,PackageRedemptionInput} from '../domain/class-package.js';

export interface PackagePlanView{
 id:string;title:string;courseId:string|null;courseRestricted:boolean;sessionCredits:number;
 priceCOP:number;validDays:number;active:boolean;createdAt:Date;
}
export interface PackageEntitlementView{
 id:string;packageId:string;studentUserId:string;credits:number;used:number;
 remaining:number;activeBookingIds:string[];expiresAt:Date;issuedAt:Date;revokedAt:Date|null;
 package:{title:string;courseId:string|null;priceCOP:number};
}
export interface PackageRedeemResult{
 id:string;bookingId:string;entitlementId:string;remaining:number;
 alreadyRedeemed:boolean;
}
export interface ClassPackagesRepository{
 plans(workspaceId:string,actorId:string):Promise<PackagePlanView[]>;
 create(workspaceId:string,actorId:string,input:PackagePlanInput):Promise<PackagePlanView>;
 setActive(workspaceId:string,actorId:string,packageId:string,active:boolean):Promise<PackagePlanView>;
 issue(workspaceId:string,actorId:string,packageId:string,input:PackageIssueInput):Promise<PackageEntitlementView>;
 mine(workspaceId:string,userId:string):Promise<PackageEntitlementView[]>;
 redeem(workspaceId:string,userId:string,input:PackageRedemptionInput):Promise<PackageRedeemResult>;
}
