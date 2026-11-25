export interface EmailPreferenceRepository{
 read(w:string,u:string):Promise<{enabled:boolean}>;
 save(w:string,u:string,enabled:boolean):Promise<{enabled:boolean}>;
}
export type EmailJob={notificationId:string;lease:string;attempts:number};
export type EmailOutcome={state:'QUEUED'|'SENT'|'SKIPPED'|'FAILED';providerId:string|null;errorCode:string|null};
export interface EmailNoticeQueue{
 enqueue(now:Date):Promise<number>;
 claim(now:Date):Promise<EmailJob|null>;
 recipient(job:EmailJob,now:Date):Promise<string|null>;
 finish(job:EmailJob,outcome:EmailOutcome,now:Date):Promise<void>;
}
export interface EmailProvider{
 send(input:{notificationId:string;recipient:string}):Promise<string>;
}
export class EmailProviderFailure extends Error{
 constructor(readonly retryable:boolean,readonly code:string){super(code);}
}
