import test from 'node:test';
import assert from 'node:assert/strict';
import {GoogleOAuth} from '../modules/integrations/infrastructure/google-oauth.js';
import {OAuthCrypto} from '../modules/integrations/infrastructure/oauth-crypto.js';
import {GoogleCalendarConnection} from '../modules/integrations/application/google-use-cases.js';
import {CALENDAR_SCOPE,InvalidAuthorization,IntegrationDenied} from '../modules/integrations/domain/google-connection.js';
import type {OAuthAttempt} from '../modules/integrations/domain/google-connection.js';
import type {GoogleConnectionRepository} from '../modules/integrations/application/google-ports.js';

const config={clientId:'fake-client',clientSecret:'fake-secret',redirectUri:'https://academy.test/api/v1/integrations/google-calendar/callback',enabled:true};
const crypto=new OAuthCrypto(Buffer.alloc(32,42));
test('OAuth uses state, PKCE, owned calendar scope and independent callback',()=>{
 const oauth=new GoogleOAuth(config);
 const url=new URL(oauth.authorizationUrl('state','verifier'));
 assert.equal(url.origin,'https://accounts.google.com');
 assert.equal(url.searchParams.get('scope'),CALENDAR_SCOPE);
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('state'),'state');
 assert.equal(url.searchParams.get('redirect_uri'),config.redirectUri);
 assert.equal(url.searchParams.has('client_secret'),false);
});
test('encrypted credentials are authenticated and bound to the academy and owner',()=>{
 const token=crypto.seal('secret-token','academy-a/user-a');
 assert.notEqual(token,'secret-token');
 assert.equal(crypto.open(token,'academy-a/user-a'),'secret-token');
 assert.throws(()=>crypto.open(token,'academy-b/user-a'));
 assert.throws(()=>new OAuthCrypto(Buffer.alloc(32,43)).open(token,'academy-a/user-a'));
});
test('provider exchange rejects missing scopes and offline credentials',async()=>{
 const oauth=new GoogleOAuth(config,async()=>new Response(JSON.stringify({access_token:'x',expires_in:3600,scope:'openid'})));
 await assert.rejects(()=>oauth.exchange('code','verifier'),InvalidAuthorization);
});
test('state cannot be used by another user or replayed, and saved tokens are encrypted',async()=>{
 let attempt:OAuthAttempt|null=null,claimed=false,saved='';
 const repo:GoogleConnectionRepository={
  status:async()=>null,
  begin:async a=>{attempt=a;claimed=false;},
  consume:async(hash,userId)=>{
   if(!attempt||claimed||attempt.stateHash!==hash||attempt.userId!==userId)return null;
   claimed=true;return attempt;
  },
  save:async(_,token)=>{saved=token;},
  disconnect:async()=>{attempt=null;},
 };
 const oauth=new GoogleOAuth(config,async()=>new Response(JSON.stringify({
  access_token:'access-token',refresh_token:'refresh-token',expires_in:3600,scope:CALENDAR_SCOPE,
 })));
 const app=new GoogleCalendarConnection(repo,{hasAnyRole:async(w,u)=>w==='a'&&u==='teacher'},oauth,crypto);
 await assert.rejects(()=>app.start('b','teacher'),IntegrationDenied);
 const result=await app.start('a','teacher');
 const state=new URL(result.authorizationUrl).searchParams.get('state')!;
 await assert.rejects(()=>app.complete('other',state,'code'),InvalidAuthorization);
 await app.complete('teacher',state,'code');
 assert.ok(saved&&!saved.includes('refresh-token'));
 await assert.rejects(()=>app.complete('teacher',state,'code'),InvalidAuthorization);
});
