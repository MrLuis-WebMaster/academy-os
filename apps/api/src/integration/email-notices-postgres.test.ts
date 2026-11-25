import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {PrismaEmailNoticeQueue,PrismaEmailPreferences} from '../modules/notifications/infrastructure/prisma-email-notices.js';
test('PostgreSQL: opt-in excludes older notices, leases deduplicate, and revocation blocks send',async()=>{
 const suffix=randomUUID().slice(0,12);
 const user=await prisma.user.create({data:{name:'Student',email:'email-'+suffix+'@example.invalid',emailVerified:true}});
 const ids:string[]=[];
 try{
  const w=await prisma.workspace.create({data:{name:'Email A',slug:'email-a-'+suffix,type:'ACADEMY',members:{create:{userId:user.id,role:'STUDENT'}}}});ids.push(w.id);
  const b=await prisma.workspace.create({data:{name:'Email B',slug:'email-b-'+suffix,type:'ACADEMY',members:{create:{userId:user.id,role:'STUDENT'}}}});ids.push(b.id);
  const prefs=new PrismaEmailPreferences(),queue=new PrismaEmailNoticeQueue();
  assert.equal((await prefs.read(w.id,user.id)).enabled,false);
  const create=(workspaceId:string,eventKey:string,kind:string,createdAt:Date)=>prisma.notification.create({data:{workspaceId,userId:user.id,eventKey,kind,title:'Private title',body:'Private body',createdAt}});
  const old=await create(w.id,'old','BOOKING_CONFIRMED',new Date(Date.now()-60000));
  await prefs.save(w.id,user.id,true);
  const now=new Date(Date.now()+2000);
  const eligible=await create(w.id,'new','BOOKING_CONFIRMED',now);
  const other=await create(b.id,'other','BOOKING_CONFIRMED',now);
  const sos=await create(w.id,'sos','SOS_ANSWERED',now);
  await Promise.all([queue.enqueue(now),queue.enqueue(now)]);
  const rows=await prisma.emailNoticeDelivery.findMany({where:{notificationId:{in:[old.id,eligible.id,other.id,sos.id]}}});
  assert.deepEqual(rows.map(x=>x.notificationId),[eligible.id]);
  const claimed=await Promise.all([queue.claim(now),queue.claim(now)]);
  const job=claimed.find(x=>x?.notificationId===eligible.id);assert.ok(job);
  assert.equal(claimed.filter(x=>x?.notificationId===eligible.id).length,1);
  assert.equal(await queue.recipient(job,now),user.email);
  await prefs.save(w.id,user.id,false);
  assert.equal(await queue.recipient(job,now),null);
  await queue.finish({...job,lease:'wrong'},{state:'SENT',providerId:'fake',errorCode:null},now);
  assert.equal((await prisma.emailNoticeDelivery.findUniqueOrThrow({where:{notificationId:eligible.id}})).state,'QUEUED');
  await queue.finish(job,{state:'SKIPPED',providerId:null,errorCode:'NO_LONGER_ELIGIBLE'},now);
  await queue.enqueue(now);
  assert.equal((await prisma.emailNoticeDelivery.findUniqueOrThrow({where:{notificationId:eligible.id}})).state,'SKIPPED');
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:ids}}});
  await prisma.user.delete({where:{id:user.id}});
  await prisma.$disconnect();
 }
});
