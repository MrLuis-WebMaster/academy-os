export type PlanCode='STARTER'|'PRO'|'ACADEMY';
export const PLAN_LIMITS={
 STARTER:{students:30,teachers:1,storageBytes:25*1024*1024},
 PRO:{students:150,teachers:5,storageBytes:50*1024*1024},
 ACADEMY:{students:1000,teachers:30,storageBytes:100*1024*1024},
} as const;
export type Assignment={plan:PlanCode;validUntil:Date|null};
export type Usage={students:number;teachers:number;storageBytes:number};
export class SaasDenied extends Error{}
export class SaasMissing extends Error{}
export class SaasInvalid extends Error{}
export function effectivePlan(assignment:Assignment|null,now=new Date()):PlanCode{
 return assignment&&(!assignment.validUntil||assignment.validUntil>now)?assignment.plan:'STARTER';
}
export function parseAssignment(raw:unknown,now=new Date()){
 if(!raw||typeof raw!=='object')throw new SaasInvalid('Invalid plan assignment');
 const v=raw as Record<string,unknown>;
 if(typeof v.plan!=='string'||!Object.hasOwn(PLAN_LIMITS,v.plan)||typeof v.reason!=='string'||v.reason.trim().length<6||v.reason.trim().length>300)
  throw new SaasInvalid('Plan and reason are required');
 const plan=v.plan as PlanCode;
 let validUntil:Date|null=null;
 if(v.validUntil!==null&&v.validUntil!==undefined){
  if(typeof v.validUntil!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(v.validUntil))throw new SaasInvalid('Invalid expiration');
  validUntil=new Date(v.validUntil);
  if(!Number.isFinite(validUntil.getTime())||validUntil<=now)throw new SaasInvalid('Expiration must be in the future');
 }
 if(plan!=='STARTER'&&!validUntil)throw new SaasInvalid('Paid-tier manual assignments require an expiration');
 return {plan,validUntil,reason:v.reason.trim()};
}
export function planSummary(assignment:Assignment|null,usage:Usage,enforced:boolean,now=new Date()){
 const plan=effectivePlan(assignment,now);
 return {plan,assignedPlan:assignment?.plan??'STARTER',validUntil:assignment?.validUntil??null,limits:PLAN_LIMITS[plan],usage,enforced};
}
