import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import type {IntegrationCryptoPort} from '../application/google-ports.js';
export class OAuthCrypto implements IntegrationCryptoPort{
 constructor(private readonly key?:Buffer){}
 nonce(){return randomBytes(32).toString('base64url');}
 digest(value:string){return createHash('sha256').update(value).digest('hex');}
 private requireKey(){if(this.key?.length!==32)throw new Error('Integration encryption key unavailable');return this.key;}
 seal(value:string,context:string){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.requireKey(),iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(x=>x.toString('base64url')).join('.');
 }
 open(value:string,context:string){
  const parts=value.split('.');if(parts.length!==3)throw new Error('Invalid encrypted credential');
  const [iv,tag,data]=parts.map(x=>Buffer.from(x,'base64url'));
  if(!iv||!tag||!data||iv.length!==12||tag.length!==16)throw new Error('Invalid encrypted credential');
  const decipher=createDecipheriv('aes-256-gcm',this.requireKey(),iv);
  decipher.setAAD(Buffer.from(context));decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8');
 }
}
