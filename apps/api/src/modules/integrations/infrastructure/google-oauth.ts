import {createHash} from 'node:crypto';
import {CALENDAR_SCOPE,InvalidAuthorization,validGoogleCredential} from '../domain/google-connection.js';
import type {GoogleOAuthPort} from '../application/google-ports.js';
export type GoogleOAuthConfig={clientId:string;clientSecret:string;redirectUri:string;enabled:boolean};
export class GoogleOAuth implements GoogleOAuthPort{
 constructor(private readonly config:GoogleOAuthConfig,private readonly transport:typeof fetch=fetch){}
 configured(){return this.config.enabled&&!!this.config.clientId&&!!this.config.clientSecret;}
 authorizationUrl(state:string,verifier:string){
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:this.config.clientId,redirect_uri:this.config.redirectUri,response_type:'code',
   scope:CALENDAR_SCOPE,access_type:'offline',prompt:'consent',state,
   code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  return url.toString();
 }
 async exchange(code:string,verifier:string){
  const response=await this.transport('https://oauth2.googleapis.com/token',{
   method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},redirect:'error',
   signal:AbortSignal.timeout(10_000),
   body:new URLSearchParams({code,client_id:this.config.clientId,client_secret:this.config.clientSecret,
    redirect_uri:this.config.redirectUri,code_verifier:verifier,grant_type:'authorization_code'}),
  });
  if(!response.ok)throw new InvalidAuthorization('Google authorization could not be completed');
  return validGoogleCredential(await response.json());
 }
}
