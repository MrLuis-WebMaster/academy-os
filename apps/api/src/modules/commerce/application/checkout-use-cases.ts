import type {MembershipPort} from '../../academics/application/ports.js';
import type {MerchantGatewayResolver} from './merchant-ports.js';
import type {CheckoutRepository,PaymentGateway} from './checkout-ports.js';
import {CheckoutDisabled,CheckoutUnavailable,CheckoutConflict,checkoutView} from '../domain/checkout.js';
export class CheckoutUseCases{
 constructor(private readonly repo:CheckoutRepository,private readonly gateway:PaymentGateway,private readonly members:MembershipPort,private readonly merchants?:MerchantGatewayResolver){}
 private async resolve(w:string,forNewPayment:boolean){return this.merchants?this.merchants.resolve(w,forNewPayment):this.gateway;}
 async list(w:string,u:string){
  if(!await this.members.hasAnyRole(w,u,['STUDENT']))throw new CheckoutUnavailable('Checkout not available');
  const gateway=await this.resolve(w,false),newGateway=await this.resolve(w,true);
  const config=gateway?.config();
  return {enabled:newGateway?.config()?.workspaceId===w,reconciliationEnabled:config?.workspaceId===w,environment:config?.workspaceId===w?config.environment:null,items:(await this.repo.list(w,u)).map(checkoutView)};
 }
 async start(w:string,u:string,id:string){
  const gateway=await this.resolve(w,true);
  const config=gateway?.config();
  if(!gateway||!config||config.workspaceId!==w)throw new CheckoutDisabled('Checkout not enabled for this academy');
  if(!await this.members.hasAnyRole(w,u,['STUDENT']))throw new CheckoutUnavailable('Checkout not available');
  const row=await this.repo.create(w,u,id,config,gateway.reference(),new Date(Date.now()+30*60_000));
  if(row.providerTransactionId||row.providerStatus!=='PENDING'||row.expiresAt<=new Date())throw new CheckoutConflict('Checkout expired or resolved; contact your academy');
  return {...checkoutView(row),url:gateway.url(row)};
 }
 async reconcile(w:string,u:string,id:string,raw:unknown){
  const gateway=await this.resolve(w,false);
  const config=gateway?.config();
  if(!gateway||!config||config.workspaceId!==w)throw new CheckoutDisabled('Checkout not enabled for this academy');
  const manager=await this.members.hasAnyRole(w,u,['OWNER','ADMIN']);
  if(!manager&&!await this.members.hasAnyRole(w,u,['STUDENT']))throw new CheckoutUnavailable('Checkout not available');
  const row=await this.repo.target(w,u,id,manager);
  if(row.environment!==config.environment||row.merchantKeyHash!==config.merchantKeyHash)throw new CheckoutConflict('Merchant configuration changed');
  const submitted=raw&&typeof raw==='object'?(raw as Record<string,unknown>).transactionId:undefined;
  const transactionId=submitted??row.providerTransactionId;
  if(typeof transactionId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(transactionId))throw new CheckoutConflict('A valid provider transaction ID is required');
  if(row.providerTransactionId&&row.providerTransactionId!==transactionId)throw new CheckoutConflict('Transaction ID differs from the registered payment');
  const payment=await gateway.readTransaction(transactionId);
  if(payment.reference!==row.reference)throw new CheckoutUnavailable('Transaction not available for this order');
  return this.repo.apply(config,payment);
 }
 async webhook(raw:unknown,workspaceId?:string){
  const gateway=workspaceId?await this.resolve(workspaceId,false):this.gateway;
  const config=gateway?.config();
  if(!gateway||!config||(workspaceId&&config.workspaceId!==workspaceId))throw new CheckoutDisabled('Checkout disabled');
  const verified=await gateway.verifyEvent(raw);
  if(!verified)return {handled:false};
  return this.repo.apply(config,verified);
 }
}
