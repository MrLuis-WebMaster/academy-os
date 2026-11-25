import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEmailPreference,emailMessage,emailRetryDelay,EmailNoticeInvalid} from '../modules/notifications/domain/email-notice.js';
import {EmailNoticePreferences,DeliverEmailNotices} from '../modules/notifications/application/email-notice-use-cases.js';
import {EmailProviderFailure,type EmailNoticeQueue,type EmailJob,type EmailOutcome} from '../modules/notifications/application/email-notice-ports.js';
import {ResendEmailProvider} from '../modules/notifications/infrastructure/resend-email-provider.js';
test('email consent must be explicit and can be revoked while disabled',async()=>{
 assert.throws(()=>parseEmailPreference({enabled:'true'}),EmailNoticeInvalid);
 let enabled=true;
 const app=new EmailNoticePreferences({read:async()=>({enabled}),save:async(_w,_u,v)=>({enabled:enabled=v})},{hasAnyRole:async()=>true},false);
 await assert.rejects(()=>app.save('w','u',{enabled:true}));
 assert.equal((await app.save('w','u',{enabled:false})).enabled,false);
 assert.throws(()=>emailMessage('http://localhost'),EmailNoticeInvalid);
 assert.equal(emailRetryDelay(100),3600000);
});
test('delivery skips revoked consent, retries transient errors and stops at limit',async()=>{
 const jobs:EmailJob[]=['skip','sent','retry','last','fatal'].map(id=>({notificationId:id,lease:id,attempts:id==='last'?5:0}));
 const outcomes:Record<string,EmailOutcome>={};let calls=0;
 const queue:EmailNoticeQueue={enqueue:async()=>5,claim:async()=>jobs.shift()??null,recipient:async j=>j.notificationId==='skip'?null:'student@example.invalid',finish:async(j,o)=>{outcomes[j.notificationId]=o;}};
 const worker=new DeliverEmailNotices(queue,{send:async({notificationId})=>{calls++;if(notificationId==='retry'||notificationId==='last')throw new EmailProviderFailure(true,'NETWORK_ERROR');if(notificationId==='fatal')throw new EmailProviderFailure(false,'INVALID_RECIPIENT');return 'provider-id';}});
 assert.deepEqual(await worker.execute(),{enqueued:5,sent:1,skipped:1,failed:3});
 assert.equal(calls,4);assert.equal(outcomes.skip?.state,'SKIPPED');assert.equal(outcomes.sent?.state,'SENT');assert.equal(outcomes.retry?.state,'QUEUED');assert.equal(outcomes.last?.state,'FAILED');assert.equal(outcomes.fatal?.state,'FAILED');
});
test('Resend adapter preserves idempotency and minimizes payload',async()=>{
 const requests:Array<{key:string|null;body:unknown}>=[];
 const provider=new ResendEmailProvider('re_fixture','AcademyOS <no-reply@example.invalid>','https://academy.example.invalid',async(_url,init)=>{
  requests.push({key:new Headers(init?.headers).get('Idempotency-Key'),body:JSON.parse(String(init?.body))});
  return new Response(JSON.stringify({id:'email-id'}),{status:200});
 });
 assert.equal(await provider.send({notificationId:'notice',recipient:'student@example.invalid'}),'email-id');
 await provider.send({notificationId:'notice',recipient:'student@example.invalid'});
 assert.deepEqual(requests[0],requests[1]);assert.equal(requests[0]?.key,'academy-os-notice/notice');
 assert.deepEqual(Object.keys(requests[0]!.body as object).sort(),['from','subject','text','to']);
});
