import type {MembershipPort} from '../../academics/application/ports.js';
import type {PaymentCaseRepository} from './payment-case-ports.js';
import {parseCaseAction} from '../domain/payment-case.js';
import {CheckoutUnavailable,CheckoutConflict} from '../domain/checkout.js';
export class PaymentCaseUseCases{
 constructor(private readonly repo:PaymentCaseRepository,private readonly members:MembershipPort){}
 private async allow(w:string,u:string){if(!await this.members.hasAnyRole(w,u,['OWNER','ADMIN']))throw new CheckoutUnavailable('Payment case unavailable');}
 async list(w:string,u:string,after:unknown){await this.allow(w,u);if(after!==undefined&&after!==null&&(typeof after!=='string'||after.length>128))throw new CheckoutConflict('Invalid cursor');return this.repo.list(w,u,typeof after==='string'&&after?after:null);}
 async detail(w:string,u:string,id:string){await this.allow(w,u);return this.repo.detail(w,u,id);}
 async apply(w:string,u:string,id:string,raw:unknown){await this.allow(w,u);return this.repo.apply(w,u,id,parseCaseAction(raw));}
}
