export type PaymentEnvironment='test'|'prod';
export type CheckoutConfig={workspaceId:string;environment:PaymentEnvironment;merchantKeyHash:string;issuerId:string|null;workspaceConfigured?:boolean};
export type CheckoutRecord={orderId:string;reference:string;environment:string;merchantKeyHash:string;amountInCents:bigint;expiresAt:Date;providerStatus:string;resolution:string;providerTransactionId:string|null};
export type VerifiedTransaction={id:string;reference:string;amountInCents:number;currency:'COP';status:'PENDING'|'APPROVED'|'DECLINED'|'VOIDED'|'ERROR'};
export class CheckoutDisabled extends Error{}
export class InvalidPaymentEvent extends Error{}
export class CheckoutUnavailable extends Error{}
export class CheckoutConflict extends Error{}
export class PaymentProviderUnavailable extends Error{}
export function amountInCents(priceCOP:number){
 if(!Number.isSafeInteger(priceCOP)||priceCOP<=0||priceCOP>500000000)throw new CheckoutConflict('Invalid order price');
 return priceCOP*100;
}
export function checkoutView(row:CheckoutRecord){
 return {orderId:row.orderId,environment:row.environment,providerStatus:row.providerStatus,resolution:row.resolution,expiresAt:row.expiresAt,transactionKnown:Boolean(row.providerTransactionId)};
}
