import {CalendarSyncConflict} from '../domain/calendar-event.js';
import {IntegrationDenied,IntegrationUnavailable} from '../domain/google-connection.js';
export type CalendarSyncJob={id:string;leaseToken:string;revision:number;attempts:number;
 workspaceId:string;userId:string;sessionId:string;connectionId:string;connectionGeneration:Date};
export interface CalendarSyncQueue{
 claim(now:Date):Promise<CalendarSyncJob|null>;
 finish(job:CalendarSyncJob,outcome:{ok:boolean;permanent?:boolean;code?:string},now:Date):Promise<void>;
}
export interface CalendarWorkerExporter{
 execute(workspaceId:string,userId:string,sessionId:string,raw:unknown,expectedConnection:{id:string;generation:Date}):Promise<unknown>;
}
export class ProcessCalendarSyncQueue{
 constructor(private readonly queue:CalendarSyncQueue,private readonly exporter:CalendarWorkerExporter){}
 async execute(limit=10){
  const summary={processed:0,succeeded:0,failed:0};
  for(let i=0;i<Math.min(20,Math.max(1,limit));i++){
   const job=await this.queue.claim(new Date());
   if(!job)break;
   let outcome:{ok:boolean;permanent?:boolean;code?:string};
   try{
    await this.exporter.execute(job.workspaceId,job.userId,job.sessionId,{createMeet:false},
     {id:job.connectionId,generation:job.connectionGeneration});
    outcome={ok:true};summary.succeeded++;
   }catch(e){
    // Do not log provider responses, titles, URLs or credentials.
    const permanent=e instanceof IntegrationDenied||e instanceof CalendarSyncConflict;
    outcome={ok:false,permanent,code:permanent?'REVIEW_REQUIRED':e instanceof IntegrationUnavailable?'DISABLED':'PROVIDER_UNAVAILABLE'};
    summary.failed++;
   }
   await this.queue.finish(job,outcome,new Date());
   summary.processed++;
  }
  return summary;
 }
}
