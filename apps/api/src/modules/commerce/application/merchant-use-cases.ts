import type {MerchantRepository} from './merchant-ports.js';
import type {MembershipPort} from '../../academics/application/ports.js';
import {CheckoutUnavailable,CheckoutConflict} from '../domain/checkout.js';
import {parseMerchantCredentials} from '../domain/merchant.js';
export class MerchantUseCases{
 constructor(private readonly repository:MerchantRepository,private readonly members:MembershipPort){}
 private async authorize(w:string,u:string){if(!await this.members.hasAnyRole(w,u,['OWNER']))throw new CheckoutUnavailable('Only the academy owner can configure payments');}
 async status(w:string,u:string){await this.authorize(w,u);return this.repository.status(w,u);}
 async configure(w:string,u:string,raw:unknown){await this.authorize(w,u);return this.repository.configure(w,u,parseMerchantCredentials(raw));}
 async setAccepting(w:string,u:string,raw:unknown){
  await this.authorize(w,u);
  if(!raw||typeof raw!=='object'||typeof (raw as Record<string,unknown>).accepting!=='boolean')throw new CheckoutConflict('Explicit payment acceptance setting required');
  return this.repository.setAccepting(w,u,(raw as {accepting:boolean}).accepting);
 }
}
