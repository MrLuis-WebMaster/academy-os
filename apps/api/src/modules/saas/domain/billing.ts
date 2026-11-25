import {SaasInvalid,type Assignment,type PlanCode} from './plan.js';
export type PaidPlan=Exclude<PlanCode,'STARTER'>;
export type BillingInterval='MONTHLY'|'YEARLY';
export type BillingPrice={plan:PaidPlan;interval:BillingInterval;amountCOP:number};
export type BillingRequest={plan:PaidPlan;interval:BillingInterval;expectedAmountCOP:number;requestId:string};
export type BillingReview={action:'confirm';paymentReference:string;amountCOP:number;note:string}|{action:'reject';note:string};
const validAmount=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<=500000000;
export function parseBillingRequest(raw:unknown):BillingRequest{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new SaasInvalid('Invalid subscription request');
 const v=raw as Record<string,unknown>;
 if((v.plan!=='PRO'&&v.plan!=='ACADEMY')||(v.interval!=='MONTHLY'&&v.interval!=='YEARLY')||!validAmount(v.expectedAmountCOP)||typeof v.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.requestId))throw new SaasInvalid('Invalid subscription request');
 return {plan:v.plan,interval:v.interval,expectedAmountCOP:v.expectedAmountCOP,requestId:v.requestId.toLowerCase()};
}
export function parseBillingReview(raw:unknown):BillingReview{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new SaasInvalid('Invalid billing review');
 const v=raw as Record<string,unknown>;
 if(typeof v.note!=='string'||v.note.trim().length<6||v.note.trim().length>300)throw new SaasInvalid('Review reason required');
 if(v.action==='reject')return {action:'reject',note:v.note.trim()};
 if(v.action==='confirm'&&v.confirmedExternalPayment===true&&validAmount(v.amountCOP)&&typeof v.paymentReference==='string'&&/^[A-Za-z0-9._:/-]{4,120}$/.test(v.paymentReference.trim()))return {action:'confirm',amountCOP:v.amountCOP,paymentReference:v.paymentReference.trim().toUpperCase(),note:v.note.trim()};
 throw new SaasInvalid('External payment confirmation required');
}
export function addBillingMonths(start:Date,months:1|12):Date{
 const end=new Date(start);
 const day=start.getUTCDate();
 end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+months);
 const last=new Date(end);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
 end.setUTCDate(Math.min(day,last.getUTCDate()));
 return end;
}
export function billingPeriod(assignment:Assignment|null,plan:PaidPlan,interval:BillingInterval,now:Date){
 const active=assignment&&assignment.plan!=='STARTER'&&(!assignment.validUntil||assignment.validUntil>now)?assignment:null;
 if(active&&(active.plan!==plan||!active.validUntil))throw new SaasInvalid('Resolve the active paid plan before changing billing plan');
 const start=active?.validUntil??now;
 return {start,end:addBillingMonths(start,interval==='MONTHLY'?1:12)};
}
export function priceCatalog(values:Record<string,string|undefined>):BillingPrice[]{
 const result:BillingPrice[]=[];
 for(const plan of ['PRO','ACADEMY'] as const)for(const interval of ['MONTHLY','YEARLY'] as const){
  const raw=values[plan+'_'+interval];if(!raw||!/^\d{1,9}$/.test(raw))continue;
  const amountCOP=Number(raw);if(validAmount(amountCOP))result.push({plan,interval,amountCOP});
 }
 return result;
}
