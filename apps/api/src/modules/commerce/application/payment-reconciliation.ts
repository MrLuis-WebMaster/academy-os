import type {CheckoutConfig,VerifiedTransaction} from '../domain/checkout.js';
import type {CheckoutRepository,PaymentGateway} from './checkout-ports.js';
export type ReconciliationJob={orderId:string;reference:string;transactionId:string;lease:string;attempts:number};
export interface ReconciliationQueue{
 claim(config:CheckoutConfig,now:Date):Promise<ReconciliationJob|null>;
 finish(job:ReconciliationJob,now:Date,error:string|null):Promise<void>;
}
export function reconciliationDelay(attempts:number,error:boolean){
 return Math.min(error?60:30,Math.max(1,2**Math.min(attempts,6)))*60_000;
}
export class ReconcilePayments{
 constructor(private readonly queue:ReconciliationQueue,private readonly repo:Pick<CheckoutRepository,'apply'>,private readonly gateway:PaymentGateway){}
 async execute(limit=5){
  const config=this.gateway.config();if(!config)return {checked:0,failed:0};
  let checked=0,failed=0;
  for(let i=0;i<Math.max(1,Math.min(limit,10));i++){
   const job=await this.queue.claim(config,new Date());if(!job)break;
   let error:string|null=null;
   try{
    const payment:VerifiedTransaction=await this.gateway.readTransaction(job.transactionId);
    if(payment.reference!==job.reference||payment.id!==job.transactionId)throw new Error('Unexpected transaction');
    const result=await this.repo.apply(config,payment);
    if(!result.handled)throw new Error('Checkout no longer available');
    checked++;
   }catch{error='VERIFICATION_FAILED';failed++;}
   await this.queue.finish(job,new Date(),error);
  }
  return {checked,failed};
 }
}
