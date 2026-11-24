import type {MerchantCredentials,MerchantStatus} from '../domain/merchant.js';
import type {PaymentGateway} from './checkout-ports.js';
export interface MerchantRepository{
 status(w:string,u:string):Promise<MerchantStatus>;
 configure(w:string,u:string,credentials:MerchantCredentials):Promise<MerchantStatus>;
 setAccepting(w:string,u:string,accepting:boolean):Promise<MerchantStatus>;
}
export interface MerchantGatewayResolver{
 resolve(w:string,forNewPayment:boolean):Promise<PaymentGateway|null>;
 legacy():PaymentGateway;
}
