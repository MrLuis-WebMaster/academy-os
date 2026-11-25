import type {BillingRepository} from './billing-ports.js';
import {parseBillingRequest,parseBillingReview,type BillingPrice} from '../domain/billing.js';
import {SaasInvalid} from '../domain/plan.js';
export class BillingUseCases{
 constructor(private readonly repo:BillingRepository,private readonly prices:readonly BillingPrice[],private readonly enabled:boolean){}
 private cursor(after:unknown){if(after!==undefined&&after!==null&&(typeof after!=='string'||after.length>128))throw new SaasInvalid('Invalid cursor');return typeof after==='string'&&after?after:null;}
 async mine(w:string,u:string,after:unknown){return {enabled:this.enabled,prices:this.enabled?this.prices:[],orders:await this.repo.list(w,u,this.cursor(after),false)};}
 async platform(w:string,u:string,after:unknown){return {enabled:this.enabled,orders:await this.repo.list(w,u,this.cursor(after),true)};}
 async create(w:string,u:string,raw:unknown){if(!this.enabled)throw new SaasInvalid('New subscription requests are disabled');return this.repo.create(w,u,parseBillingRequest(raw),this.prices);}
 async cancel(w:string,u:string,id:string){return this.repo.cancel(w,u,id);}
 async review(w:string,u:string,id:string,raw:unknown){const input=parseBillingReview(raw);if(input.action==='confirm'&&!this.enabled)throw new SaasInvalid('Billing confirmation disabled');return this.repo.review(w,u,id,input);}
}
