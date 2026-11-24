import type {MembershipPort} from '../../academics/application/ports.js';
import type {CheckoutRepository,PaymentGateway} from './checkout-ports.js';
import {CheckoutDisabled,CheckoutUnavailable,CheckoutConflict,checkoutView} from '../domain/checkout.js';
export class CheckoutUseCases{
 constructor(private readonly repo:CheckoutRepository,private readonly gateway:PaymentGateway,private readonly members:MembershipPort){}
 async list(w:string,u:string){
  if(!await this.members.hasAnyRole(w,u,['STUDENT']))throw new CheckoutUnavailable('Checkout not available');
  const config=this.gateway.config();
  return {enabled:config?.workspaceId===w,environment:config?.workspaceId===w?config.environment:null,items:(await this.repo.list(w,u)).map(checkoutView)};
 }
 async start(w:string,u:string,id:string){
  const config=this.gateway.config();
  if(!config||config.workspaceId!==w)throw new CheckoutDisabled('Checkout not enabled for this academy');
  if(!await this.members.hasAnyRole(w,u,['STUDENT']))throw new CheckoutUnavailable('Checkout not available');
  const row=await this.repo.create(w,u,id,config,this.gateway.reference(),new Date(Date.now()+30*60_000));
  if(row.providerStatus!=='PENDING'||row.expiresAt<=new Date())throw new CheckoutConflict('Checkout expired or resolved; contact your academy');
  return {...checkoutView(row),url:this.gateway.url(row)};
 }
 async webhook(raw:unknown){
  const config=this.gateway.config();
  if(!config)throw new CheckoutDisabled('Checkout disabled');
  const verified=await this.gateway.verifyEvent(raw);
  if(!verified)return {handled:false};
  return this.repo.apply(config,verified);
 }
}
