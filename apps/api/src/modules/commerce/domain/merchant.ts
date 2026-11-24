import {CheckoutConflict} from './checkout.js';
export type MerchantCredentials={publicKey:string;privateKey:string;integrityKey:string;eventsKey:string};
export function parseMerchantCredentials(raw:unknown):MerchantCredentials{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new CheckoutConflict('Invalid merchant credentials');
 const v=raw as Record<string,unknown>;
 const result={} as MerchantCredentials;
 const prefixes={publicKey:'pub_test_',privateKey:'prv_test_',integrityKey:'test_integrity_',eventsKey:'test_events_'} as const;
 for(const key of Object.keys(prefixes) as (keyof MerchantCredentials)[]){
  const value=v[key];if(typeof value!=='string'||value.length>512||!value.startsWith(prefixes[key])||value.length<=prefixes[key].length||!/^[a-zA-Z0-9_-]+$/.test(value))throw new CheckoutConflict('Only valid sandbox credential formats are accepted');
  result[key]=value;
 }
 return result;
}
export function merchantContext(w:string,hash:string){return JSON.stringify(['academy-os','wompi-sandbox',w,hash]);}
export type MerchantStatus={configured:boolean;acceptingPayments:boolean;available:boolean;environment:'test';webhookPath:string};
