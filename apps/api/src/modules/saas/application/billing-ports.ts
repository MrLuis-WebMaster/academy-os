import type {BillingPrice,BillingRequest,BillingReview} from '../domain/billing.js';
export type BillingOrder={id:string;plan:string;interval:string;amountCOP:number;status:string;expiresAt:Date;paidAt:Date|null;periodStart:Date|null;periodEnd:Date|null;createdAt:Date;paymentReference:string|null;resolutionNote:string|null};
export interface BillingRepository{
 list(w:string,u:string,after:string|null,platform:boolean):Promise<BillingOrder[]>;
 create(w:string,u:string,input:BillingRequest,prices:readonly BillingPrice[]):Promise<BillingOrder>;
 cancel(w:string,u:string,id:string):Promise<BillingOrder>;
 review(w:string,u:string,id:string,input:BillingReview):Promise<BillingOrder>;
}
