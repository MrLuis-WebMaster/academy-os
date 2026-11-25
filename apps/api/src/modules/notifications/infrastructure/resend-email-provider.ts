import {emailMessage} from '../domain/email-notice.js';
import {EmailProviderFailure,type EmailProvider} from '../application/email-notice-ports.js';
export class ResendEmailProvider implements EmailProvider{
 constructor(private readonly key:string,private readonly from:string,private readonly origin:string,private readonly request:typeof fetch=fetch){
  if(!key.startsWith('re_')||!from.trim()||from.length>254||/[\r\n]/.test(from))throw new Error('Email provider configuration required');
  emailMessage(origin);
 }
 async send(input:{notificationId:string;recipient:string}){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient)||input.recipient.length>254)throw new EmailProviderFailure(false,'INVALID_RECIPIENT');
  let response:Response;
  try{response=await this.request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json','Idempotency-Key':'academy-os-notice/'+input.notificationId},body:JSON.stringify({from:this.from,to:[input.recipient],...emailMessage(this.origin)}),signal:AbortSignal.timeout(10000),redirect:'error'});}
  catch{throw new EmailProviderFailure(true,'NETWORK_ERROR');}
  if(!response.ok){
   // A changed payload under the same key must never cause a send under a new key.
   if(response.status===409){let name:unknown;try{name=(await response.json() as {name?:unknown}).name;}catch{}throw new EmailProviderFailure(name==='concurrent_idempotent_requests','IDEMPOTENCY_CONFLICT');}
   throw new EmailProviderFailure(response.status===429||response.status>=500,'PROVIDER_'+response.status);
  }
  try{const data=await response.json() as {id?:unknown};if(typeof data.id!=='string'||!data.id||data.id.length>128)throw Error();return data.id;}catch{throw new EmailProviderFailure(true,'INVALID_PROVIDER_RESPONSE');}
 }
}
