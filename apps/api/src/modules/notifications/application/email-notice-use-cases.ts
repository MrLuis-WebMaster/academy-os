import type {MembershipPort} from '../../academics/application/ports.js';
import {EmailNoticeDenied,EMAIL_MAX_ATTEMPTS,parseEmailPreference} from '../domain/email-notice.js';
import {EmailProviderFailure,type EmailNoticeQueue,type EmailPreferenceRepository,type EmailProvider,type EmailOutcome} from './email-notice-ports.js';
export class EmailNoticePreferences{
 constructor(private readonly repo:EmailPreferenceRepository,private readonly members:MembershipPort,private readonly available:boolean){}
 private async authorize(w:string,u:string){if(!await this.members.hasAnyRole(w,u,['STUDENT']))throw new EmailNoticeDenied('Student membership required');}
 async read(w:string,u:string){await this.authorize(w,u);return {...await this.repo.read(w,u),available:this.available};}
 async save(w:string,u:string,raw:unknown){await this.authorize(w,u);const enabled=parseEmailPreference(raw);if(enabled&&!this.available)throw new EmailNoticeDenied('Email notices are not available');return {...await this.repo.save(w,u,enabled),available:this.available};}
}
export class DeliverEmailNotices{
 constructor(private readonly queue:EmailNoticeQueue,private readonly provider:EmailProvider){}
 async execute(limit=10){
  const enqueued=await this.queue.enqueue(new Date());let sent=0,skipped=0,failed=0;
  for(let i=0;i<Math.max(1,Math.min(limit,20));i++){
   const job=await this.queue.claim(new Date());if(!job)break;
   let outcome:EmailOutcome;
   try{
    const recipient=await this.queue.recipient(job,new Date());
    if(!recipient){outcome={state:'SKIPPED',providerId:null,errorCode:'NO_LONGER_ELIGIBLE'};skipped++;}
    else{const providerId=await this.provider.send({notificationId:job.notificationId,recipient});outcome={state:'SENT',providerId,errorCode:null};sent++;}
   }catch(e){
    const retryable=!(e instanceof EmailProviderFailure)||e.retryable;
    outcome={state:retryable&&job.attempts+1<EMAIL_MAX_ATTEMPTS?'QUEUED':'FAILED',providerId:null,errorCode:e instanceof EmailProviderFailure?e.code:'DELIVERY_UNAVAILABLE'};failed++;
   }
   await this.queue.finish(job,outcome,new Date());
  }
  return {enqueued,sent,skipped,failed};
 }
}
