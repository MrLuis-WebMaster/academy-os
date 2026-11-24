import type {MembershipPort} from '../../academics/application/ports.js';
import {IntegrationDenied,IntegrationUnavailable,InvalidAuthorization} from '../domain/google-connection.js';
import type {GoogleConnectionRepository,GoogleOAuthPort,IntegrationCryptoPort} from './google-ports.js';
const attemptContext=(workspaceId:string,userId:string)=>JSON.stringify(['google-calendar-state',workspaceId,userId]);
const credentialContext=(workspaceId:string,userId:string)=>JSON.stringify(['google-calendar-token',workspaceId,userId]);
export class GoogleCalendarConnection{
 constructor(private readonly repo:GoogleConnectionRepository,private readonly members:MembershipPort,
  private readonly google:GoogleOAuthPort,private readonly crypto:IntegrationCryptoPort){}
 private async allow(workspaceId:string,userId:string){
  if(!workspaceId||!userId||!await this.members.hasAnyRole(workspaceId,userId,['OWNER','ADMIN','TEACHER']))
   throw new IntegrationDenied('Not authorized to manage this connection');
 }
 async status(workspaceId:string,userId:string){
  await this.allow(workspaceId,userId);
  const connectedAt=await this.repo.status(workspaceId,userId);
  return {configured:this.google.configured(),connected:!!connectedAt,connectedAt};
 }
 async start(workspaceId:string,userId:string){
  await this.allow(workspaceId,userId);
  if(!this.google.configured())throw new IntegrationUnavailable('Google Calendar integration is disabled');
  const state=this.crypto.nonce(),verifier=this.crypto.nonce();
  await this.repo.begin({stateHash:this.crypto.digest(state),workspaceId,userId,
   encryptedVerifier:this.crypto.seal(verifier,attemptContext(workspaceId,userId)),expiresAt:new Date(Date.now()+10*60_000)});
  return {authorizationUrl:this.google.authorizationUrl(state,verifier)};
 }
 async complete(userId:string,state:unknown,code:unknown){
  if(typeof state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(state))
   throw new InvalidAuthorization('Invalid authorization state');
  if(typeof code!=='string'||!code||code.length>4096)throw new InvalidAuthorization('Authorization was not granted');
  if(!this.google.configured())throw new IntegrationUnavailable('Google Calendar integration is disabled');
  const attempt=await this.repo.consume(this.crypto.digest(state),userId,new Date());
  if(!attempt)throw new InvalidAuthorization('Authorization state expired or was already used');
  await this.allow(attempt.workspaceId,userId);
  const verifier=this.crypto.open(attempt.encryptedVerifier,attemptContext(attempt.workspaceId,userId));
  const credential=await this.google.exchange(code,verifier);
  const sealed=this.crypto.seal(JSON.stringify(credential),credentialContext(attempt.workspaceId,userId));
  await this.repo.save(attempt,sealed);
 }
 async disconnect(workspaceId:string,userId:string){
  await this.allow(workspaceId,userId);await this.repo.disconnect(workspaceId,userId);
  return {connected:false};
 }
}
