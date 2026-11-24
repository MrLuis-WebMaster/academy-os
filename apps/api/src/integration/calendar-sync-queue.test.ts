import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {PrismaCalendarExport} from '../modules/integrations/infrastructure/prisma-calendar-export.js';
import {PrismaCalendarSyncQueue} from '../modules/integrations/infrastructure/prisma-calendar-sync-queue.js';
import {ProcessCalendarSyncQueue,type CalendarSyncJob} from '../modules/integrations/application/calendar-sync-worker.js';
import {IntegrationDenied} from '../modules/integrations/domain/google-connection.js';

test('worker passes only the claimed class and connection generation and classifies authorization failures',async()=>{
 const job:CalendarSyncJob={id:'j',leaseToken:'lease',revision:1,attempts:0,workspaceId:'w',userId:'u',sessionId:'s',connectionId:'c',connectionGeneration:new Date()};
 let claims=0,seen:unknown;
 const queue={claim:async()=>claims++===0?job:null,finish:async(_job:CalendarSyncJob,outcome:unknown)=>{seen=outcome;}};
 const worker=new ProcessCalendarSyncQueue(queue,{execute:async(w,u,s,raw,expected)=>{
  assert.deepEqual([w,u,s],['w','u','s']);assert.deepEqual(raw,{createMeet:false});
  assert.deepEqual(expected,{id:'c',generation:job.connectionGeneration});throw new IntegrationDenied('revoked');
 }});
 assert.deepEqual(await worker.execute(),{processed:1,succeeded:0,failed:1});
 assert.deepEqual(seen,{ok:false,permanent:true,code:'REVIEW_REQUIRED'});
});

test('PostgreSQL: opted-in changes enqueue atomically and newer revisions survive stale acknowledgements',async()=>{
 const nonce=randomUUID().slice(0,12);
 const owner=await prisma.user.create({data:{email:'sync-'+nonce+'@example.invalid',name:'Owner'}});
 let workspaceId:string|undefined;
 try{
  const workspace=await prisma.workspace.create({data:{slug:'sync-'+nonce,name:'Sync',type:'SOLO',members:{create:{userId:owner.id,role:'OWNER'}}}});
  workspaceId=workspace.id;
  const lesson=await prisma.classSession.create({data:{workspaceId,title:'Initial class',mode:'ONLINE',status:'CONFIRMED',
   startsAt:new Date(Date.now()+3600_000),endsAt:new Date(Date.now()+7200_000),timezone:'America/Bogota'}});
  const connection=await prisma.externalConnection.create({data:{workspaceId,userId:owner.id,provider:'GOOGLE_CALENDAR',encryptedCredentials:'test'}});
  const repo=new PrismaCalendarExport(),queue=new PrismaCalendarSyncQueue();
  const snapshot=await repo.snapshot(workspaceId,owner.id,lesson.id);
  assert.ok(snapshot);
  assert.equal(await repo.setAutoSync(workspaceId,owner.id,snapshot,true),true);
  assert.deepEqual(await repo.autoSyncStatus(workspaceId,owner.id,lesson.id),{enabled:true,pending:false,lastErrorCode:null});
  await prisma.classSession.update({where:{id:lesson.id},data:{title:'Changed class'}});
  const link=await prisma.calendarSyncLink.findUniqueOrThrow({where:{connectionId_sessionId:{connectionId:connection.id,sessionId:lesson.id}}});
  assert.ok(link.revision>link.deliveredRevision);
  // Exercise acknowledgment on our own record without claiming jobs from another test.
  const token=randomUUID();
  await prisma.calendarSyncLink.update({where:{id:link.id},data:{leaseToken:token,leaseUntil:new Date(Date.now()+120_000)}});
  const job:CalendarSyncJob={id:link.id,leaseToken:token,revision:link.revision,attempts:0,workspaceId,userId:owner.id,
   sessionId:lesson.id,connectionId:connection.id,connectionGeneration:connection.connectedAt};
  await prisma.classSession.update({where:{id:lesson.id},data:{status:'CANCELLED'}});
  await queue.finish(job,{ok:true},new Date());
  const pending=await prisma.calendarSyncLink.findUniqueOrThrow({where:{id:link.id}});
  assert.ok(pending.revision>pending.deliveredRevision);assert.equal(pending.leaseToken,null);
  const current=await repo.snapshot(workspaceId,owner.id,lesson.id);assert.ok(current);
  assert.equal(await repo.setAutoSync(workspaceId,owner.id,current,false),true);
  assert.equal(await prisma.calendarSyncLink.count({where:{id:link.id}}),0);
 }finally{
  if(workspaceId)await prisma.workspace.delete({where:{id:workspaceId}});
  await prisma.user.delete({where:{id:owner.id}});
  await prisma.$disconnect();
 }
});
