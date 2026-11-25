import type {CaseAction} from '../domain/payment-case.js';
export type PaymentCaseEntry={id:string;kind:string;actorUserId:string;note:string;amountCOP:number|null;externalReference:string|null;createdAt:Date};
export type PaymentCaseView={orderId:string;title:string;studentName:string;priceCOP:number;orderStatus:string;checkoutEnvironment:string|null;providerStatus:string|null;checkoutResolution:string|null;caseStatus:string|null;category:string|null;recordedRefundCOP:number;refundableCOP:number;entitlementRevoked:boolean|null;entries:PaymentCaseEntry[]};
export interface PaymentCaseRepository{
 list(w:string,u:string,after:string|null):Promise<PaymentCaseView[]>;
 detail(w:string,u:string,id:string):Promise<PaymentCaseView>;
 apply(w:string,u:string,id:string,input:CaseAction):Promise<PaymentCaseView>;
}
