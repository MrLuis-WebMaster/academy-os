import type {SaasRepository} from './ports.js';
import {SaasDenied,SaasInvalid,parseAssignment,planSummary,PLAN_LIMITS} from '../domain/plan.js';
export class SaasUseCases{
 constructor(private readonly repo:SaasRepository,private readonly enforced:boolean){}
 async summary(w:string,u:string){const data=await this.repo.summary(w,u);return {...planSummary(data.assignment,data.usage,this.enforced),catalog:PLAN_LIMITS};}
 async access(u:string){return {operator:await this.repo.isOperator(u)};}
 async list(u:string,after:unknown){if(!await this.repo.isOperator(u))throw new SaasDenied('Platform operator required');
  if(after!==undefined&&after!==null&&(typeof after!=='string'||after.length>128))throw new SaasInvalid('Invalid cursor');
  return this.repo.list(u,typeof after==='string'&&after?after:null);
 }
 async assign(u:string,w:string,raw:unknown){if(!await this.repo.isOperator(u))throw new SaasDenied('Platform operator required');return this.repo.assign(u,w,parseAssignment(raw));}
}
