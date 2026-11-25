import {CheckoutConflict} from './checkout.js';
export type CaseCategory='REFUND'|'DISPUTE'|'PAYMENT_REVIEW';
export type CaseAction={requestId:string;note:string}&({action:'open';category:CaseCategory}|{action:'note'|'close'|'reopen'}|{action:'recordRefund';amountCOP:number;externalReference:string});
export function parseCaseAction(raw:unknown):CaseAction{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new CheckoutConflict('Invalid case action');
 const x=raw as Record<string,unknown>;
 if(typeof x.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x.requestId)||typeof x.note!=='string'||x.note.trim().length<6||x.note.trim().length>500)throw new CheckoutConflict('Request ID and reason required');
 const base={requestId:x.requestId.toLowerCase(),note:x.note.trim()};
 if(x.action==='open'&&typeof x.category==='string'&&['REFUND','DISPUTE','PAYMENT_REVIEW'].includes(x.category))return {...base,action:'open',category:x.category as CaseCategory};
 if(x.action==='note'||x.action==='close'||x.action==='reopen')return {...base,action:x.action};
 if(x.action==='recordRefund'&&x.confirmedExternalRefund===true&&typeof x.amountCOP==='number'&&Number.isSafeInteger(x.amountCOP)&&x.amountCOP>0&&x.amountCOP<=500000000&&typeof x.externalReference==='string'&&/^[a-zA-Z0-9._:/-]{4,120}$/.test(x.externalReference.trim()))return {...base,action:'recordRefund',amountCOP:x.amountCOP,externalReference:x.externalReference.trim().toUpperCase()};
 throw new CheckoutConflict('Invalid action or external refund confirmation missing');
}
export function remainingRefundable(price:number,recorded:number){return Math.max(0,price-recorded);}
