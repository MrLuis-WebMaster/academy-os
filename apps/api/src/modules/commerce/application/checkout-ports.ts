import type {CheckoutConfig,CheckoutRecord,VerifiedTransaction} from '../domain/checkout.js';
export interface CheckoutRepository{
 create(w:string,u:string,orderId:string,config:CheckoutConfig,reference:string,expiresAt:Date):Promise<CheckoutRecord>;
 list(w:string,u:string):Promise<CheckoutRecord[]>;
 apply(config:CheckoutConfig,transaction:VerifiedTransaction):Promise<{handled:boolean;resolution:string}>;
}
export interface PaymentGateway{
 config():CheckoutConfig|null;
 reference():string;
 url(row:CheckoutRecord):string;
 verifyEvent(raw:unknown):Promise<VerifiedTransaction|null>;
}
