import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import type {PaymentGateway} from '../application/checkout-ports.js';
import {InvalidPaymentEvent,PaymentProviderUnavailable,CheckoutDisabled,type CheckoutConfig,type CheckoutRecord,type VerifiedTransaction,type PaymentEnvironment} from '../domain/checkout.js';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new InvalidPaymentEvent('Invalid event');return value as Record<string,unknown>;}
function transaction(raw:unknown):VerifiedTransaction{
 const x=object(raw);
 if(typeof x.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(x.id)||typeof x.reference!=='string'||x.reference.length>255||
  typeof x.amount_in_cents!=='number'||!Number.isSafeInteger(x.amount_in_cents)||x.amount_in_cents<=0||x.currency!=='COP'||
  typeof x.status!=='string'||!['PENDING','APPROVED','DECLINED','VOIDED','ERROR'].includes(x.status))throw new InvalidPaymentEvent('Invalid transaction');
 return {id:x.id,reference:x.reference,amountInCents:x.amount_in_cents,currency:'COP',status:x.status as VerifiedTransaction['status']};
}
export function verifyWompiSignature(raw:unknown,secret:string,environment:PaymentEnvironment){
 const e=object(raw),s=object(e.signature),data=object(e.data);
 if(e.environment!==environment||typeof e.timestamp!=='number'||!Number.isSafeInteger(e.timestamp)||e.timestamp<=0||!Array.isArray(s.properties)||s.properties.length<1||s.properties.length>20||typeof s.checksum!=='string'||!/^[a-f0-9]{64}$/i.test(s.checksum))throw new InvalidPaymentEvent('Invalid event signature');
 const properties=s.properties as unknown[];
 if(new Set(properties).size!==properties.length)throw new InvalidPaymentEvent('Duplicate signature field');
 const values=properties.map(p=>{
  if(typeof p!=='string'||!/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+){0,5}$/.test(p))throw new InvalidPaymentEvent('Invalid signature field');
  let value:unknown=data;
  for(const part of p.split('.')){const o=object(value);if(!Object.hasOwn(o,part)||['__proto__','constructor','prototype'].includes(part))throw new InvalidPaymentEvent('Unknown signature field');value=o[part];}
  if(typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean')throw new InvalidPaymentEvent('Invalid signature value');
  return String(value);
 });
 const expected=sha(values.join('')+e.timestamp+secret);
 if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(s.checksum,'hex')))throw new InvalidPaymentEvent('Invalid event checksum');
 if(e.event!=='transaction.updated')return null;
 if(!['transaction.id','transaction.status','transaction.amount_in_cents'].every(p=>properties.includes(p)))throw new InvalidPaymentEvent('Required transaction fields not signed');
 return transaction(data.transaction);
}
export class WompiGateway implements PaymentGateway{
 constructor(private readonly settings:{enabled:boolean;workspaceId:string;environment:string;publicKey:string;privateKey:string;integrityKey:string;eventsKey:string;issuerId:string;webOrigin:string},private readonly request:typeof fetch=fetch){}
 config():CheckoutConfig|null{
  const s=this.settings,e=s.environment;
  if(!s.enabled||!s.workspaceId||(e!=='test'&&e!=='prod')||!s.publicKey.startsWith('pub_'+e+'_')||!s.privateKey.startsWith('prv_'+e+'_')||!s.integrityKey.startsWith(e+'_integrity_')||!s.eventsKey.startsWith(e+'_events_')||(e==='prod'&&!s.issuerId))return null;
  return {workspaceId:s.workspaceId,environment:e,merchantKeyHash:sha(s.publicKey),issuerId:s.issuerId||null};
 }
 reference(){return 'AO-'+randomUUID();}
 url(row:CheckoutRecord){
  const config=this.config();if(!config||row.environment!==config.environment||row.merchantKeyHash!==config.merchantKeyHash)throw new CheckoutDisabled('Merchant configuration changed');
  const amount=row.amountInCents.toString(),expiration=row.expiresAt.toISOString();
  const url=new URL('https://checkout.wompi.co/p/');
  url.search=new URLSearchParams({'public-key':this.settings.publicKey,currency:'COP','amount-in-cents':amount,reference:row.reference,'signature:integrity':sha(row.reference+amount+'COP'+expiration+this.settings.integrityKey),'expiration-time':expiration,'redirect-url':new URL('/?paymentReturn=1&order='+encodeURIComponent(row.orderId),this.settings.webOrigin).toString()}).toString();
  return url.toString();
 }
 async verifyEvent(raw:unknown){
  const config=this.config();if(!config)throw new CheckoutDisabled('Checkout disabled');
  const event=verifyWompiSignature(raw,this.settings.eventsKey,config.environment);
  if(!event)return null;
  const verified=await this.readTransaction(event.id);
  if(verified.amountInCents!==event.amountInCents)throw new InvalidPaymentEvent('Payment amount mismatch');
  return verified;
 }
 async readTransaction(id:string){
  const config=this.config();if(!config)throw new CheckoutDisabled('Checkout disabled');
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw new InvalidPaymentEvent('Invalid transaction ID');
  const origin=config.environment==='test'?'https://sandbox.wompi.co':'https://production.wompi.co';
  try{
   const response=await this.request(origin+'/v1/transactions/'+encodeURIComponent(id),{headers:{Accept:'application/json',Authorization:'Bearer '+this.settings.privateKey},redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error('provider response');
   const verified=transaction(object(await response.json()).data);
   if(verified.id!==id)throw new Error('provider mismatch');
   return verified;
  }catch{throw new PaymentProviderUnavailable('Payment verification temporarily unavailable');}
 }
}
