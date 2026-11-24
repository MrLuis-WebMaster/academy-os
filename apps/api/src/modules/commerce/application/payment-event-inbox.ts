import type {CheckoutConfig,VerifiedTransaction} from '../domain/checkout.js';
import type {CheckoutRepository,PaymentGateway} from './checkout-ports.js';
import type {MembershipPort} from '../../academics/application/ports.js';
import {CheckoutUnavailable,CheckoutConflict} from '../domain/checkout.js';
export type SignedPaymentEvent={eventKey:string;transactionId:string;amountInCents:number;signedStatus:VerifiedTransaction['status']};
export type PaymentEventJob=SignedPaymentEvent&{id:string;lease:string;attempts:number};
export type EventOutcome={state:'DONE'|'IGNORED'|'REVIEW'|'QUEUED'|'FAILED';resolution:string|null;error:string|null};
export type PaymentEventView={id:string;environment:string;transactionId:string;signedStatus:string;state:string;attempts:number;resolution:string|null;lastErrorCode:string|null;createdAt:Date;processedAt:Date|null;nextAttemptAt:Date};
export interface PaymentEventInbox{
 enqueue(config:CheckoutConfig,event:SignedPaymentEvent):Promise<void>;
 claim(config:CheckoutConfig,now:Date):Promise<PaymentEventJob|null>;
 finish(job:PaymentEventJob,outcome:EventOutcome,now:Date):Promise<void>;
 list(w:string,u:string,after:string|null):Promise<PaymentEventView[]>;
 retry(w:string,u:string,id:string):Promise<void>;
}
export const MAX_EVENT_ATTEMPTS=12;
export function eventRetryDelay(attempts:number){return Math.min(60,2**Math.max(0,Math.min(6,attempts)))*60_000;}
export class ProcessPaymentEvents{
 constructor(private readonly inbox:PaymentEventInbox,private readonly repo:Pick<CheckoutRepository,'apply'>,private readonly gateway:PaymentGateway){}
 async execute(limit=5){
  const config=this.gateway.config();if(!config)return {processed:0,failed:0};
  let processed=0,failed=0;
  for(let i=0;i<Math.max(1,Math.min(10,limit));i++){
   const job=await this.inbox.claim(config,new Date());if(!job)break;
   let outcome:EventOutcome;
   try{
    const payment=await this.gateway.readTransaction(job.transactionId);
    if(payment.id!==job.transactionId||payment.amountInCents!==job.amountInCents){
     outcome={state:'REVIEW',resolution:null,error:'SIGNED_TRANSACTION_MISMATCH'};
    }else{
     const result=await this.repo.apply(config,payment);
     outcome={state:!result.handled?'IGNORED':result.resolution==='REVIEW_REQUIRED'?'REVIEW':'DONE',resolution:result.resolution,error:null};
    }
    processed++;
   }catch{
    failed++;
    outcome={state:job.attempts+1>=MAX_EVENT_ATTEMPTS?'FAILED':'QUEUED',resolution:null,error:'VERIFICATION_FAILED'};
   }
   await this.inbox.finish(job,outcome,new Date());
  }
  return {processed,failed};
 }
}
export class PaymentEventManagement{
 constructor(private readonly inbox:PaymentEventInbox,private readonly members:MembershipPort){}
 private async authorize(w:string,u:string){if(!await this.members.hasAnyRole(w,u,['OWNER','ADMIN']))throw new CheckoutUnavailable('Payment events not available');}
 async list(w:string,u:string,after:unknown){
  await this.authorize(w,u);
  if(after!==undefined&&after!==null&&(typeof after!=='string'||after.length>128))throw new CheckoutConflict('Invalid cursor');
  return this.inbox.list(w,u,typeof after==='string'&&after?after:null);
 }
 async retry(w:string,u:string,id:string){await this.authorize(w,u);await this.inbox.retry(w,u,id);return {queued:true};}
}
