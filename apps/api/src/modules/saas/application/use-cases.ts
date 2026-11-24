import type {SaasRepository} from './ports.js';
import {SaasDenied,SaasInvalid,parseAssignment,planSummary,PLAN_LIMITS,DEFAULT_AI_DAILY_LIMIT} from '../domain/plan.js';
export class SaasUseCases{
 constructor(private readonly repo:SaasRepository,private readonly enforced:boolean){}
 async summary(w:string,u:string){const data=await this.repo.summary(w,u);const summary=planSummary(data.assignment,data.usage,this.enforced);return {...summary,catalog:PLAN_LIMITS,operationalAiDailyLimit:this.enforced?summary.limits.aiDailyAttempts:DEFAULT_AI_DAILY_LIMIT};}
 async access(u:string){return {operator:await this.repo.isOperator(u)};}
 async list(u:string,after:unknown){if(!await this.repo.isOperator(u))throw new SaasDenied('Platform operator required');
  if(after!==undefined&&after!==null&&(typeof after!=='string'||after.length>128))throw new SaasInvalid('Invalid cursor');
  return this.repo.list(u,typeof after==='string'&&after?after:null);
 }
 async overview(u:string){if(!await this.repo.isOperator(u))throw new SaasDenied('Platform operator required');return this.repo.overview(u);}
 async audit(u:string,w:string,after:unknown){
  if(!await this.repo.isOperator(u))throw new SaasDenied('Platform operator required');
  if(!w||w.length>128||(after!==undefined&&after!==null&&(typeof after!=='string'||after.length>128)))throw new SaasInvalid('Invalid academy or cursor');
  return this.repo.audit(u,w,typeof after==='string'&&after?after:null);
 }
 async assign(u:string,w:string,raw:unknown){if(!await this.repo.isOperator(u))throw new SaasDenied('Platform operator required');return this.repo.assign(u,w,parseAssignment(raw));}
}
