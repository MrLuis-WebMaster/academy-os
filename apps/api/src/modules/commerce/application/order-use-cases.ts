import type {MembershipPort} from '../../academics/application/ports.js';
import type {PackageOrderRepository} from './order-ports.js';
import {OrderDenied,OrdersDisabled,parseCreateOrder,parseReviewOrder,parseOrderId} from '../domain/package-order.js';
export class PackageOrderUseCases{
 constructor(private readonly repo:PackageOrderRepository,private readonly members:MembershipPort,private readonly enabled:boolean){}
 private async allow(w:string,u:string,manager=false){
  if(!w||!u||!await this.members.hasAnyRole(w,u,manager?['OWNER','ADMIN']:['STUDENT']))throw new OrderDenied('Purchase access denied');
 }
 async catalog(w:string,u:string){await this.allow(w,u);return {enabled:this.enabled,items:this.enabled?await this.repo.catalog(w,u):[]};}
 async mine(w:string,u:string){await this.allow(w,u);return this.repo.mine(w,u);}
 async create(w:string,u:string,raw:unknown){await this.allow(w,u);if(!this.enabled)throw new OrdersDisabled('New purchase requests are disabled');return this.repo.create(w,u,parseCreateOrder(raw));}
 async cancel(w:string,u:string,id:unknown){await this.allow(w,u);return this.repo.cancel(w,u,parseOrderId(id));}
 async list(w:string,u:string){await this.allow(w,u,true);return this.repo.list(w,u);}
 async review(w:string,u:string,id:unknown,raw:unknown){await this.allow(w,u,true);const input=parseReviewOrder(raw);if(input.action==='fulfill'&&!this.enabled)throw new OrdersDisabled('Purchase fulfillment is disabled');return this.repo.review(w,u,parseOrderId(id),input);}
}
