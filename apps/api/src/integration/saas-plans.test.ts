import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {effectivePlan,parseAssignment,planSummary,SaasInvalid,SaasDenied} from '../modules/saas/domain/plan.js';
import {PrismaSaasRepository} from '../modules/saas/infrastructure/prisma-saas-repository.js';
import {PrismaInvitationRepository} from '../modules/tenancy/infrastructure/prisma-invitation-repository.js';
import {InvitationLimitReached} from '../modules/tenancy/application/invitation-use-cases.js';
import {SaasUseCases} from '../modules/saas/application/use-cases.js';
test('plans expire to Starter without changing historical assignment',()=>{
 const now=new Date('2026-11-24T00:00:00Z');
 const expired={plan:'PRO' as const,validUntil:now};
 assert.equal(effectivePlan(expired,now),'STARTER');
 assert.equal(planSummary(expired,{students:50,teachers:2,storageBytes:0},true,now).assignedPlan,'PRO');
 assert.throws(()=>parseAssignment({plan:'PRO',reason:'manual grant'},now),SaasInvalid);
 assert.throws(()=>parseAssignment({plan:'__proto__',reason:'invalid plan'},now),SaasInvalid);
 assert.equal(parseAssignment({plan:'ACADEMY',validUntil:'2027-01-01T00:00:00Z',reason:'manual grant'},now).plan,'ACADEMY');
});
test('PostgreSQL: verified platform operators alone can assign plans; tenant summary remains scoped',async()=>{
 const nonce=randomUUID().slice(0,12);
 const [operator,owner,unverified]=await Promise.all([
  prisma.user.create({data:{name:'Operator',email:'operator-'+nonce+'@example.invalid',emailVerified:true}}),
  prisma.user.create({data:{name:'Owner',email:'owner-'+nonce+'@example.invalid',emailVerified:true}}),
  prisma.user.create({data:{name:'Unverified',email:'unverified-'+nonce+'@example.invalid'}}),
 ]);
 let id:string|undefined;
 try{
  const w=await prisma.workspace.create({data:{slug:'saas-'+nonce,name:'Academy',type:'ACADEMY',members:{create:{role:'OWNER',userId:owner.id}}}});id=w.id;
  const repo=new PrismaSaasRepository(new Set([operator.id,unverified.id]));
  const app=new SaasUseCases(repo,true);
  assert.equal((await app.summary(w.id,owner.id)).plan,'STARTER');
  assert.equal((await app.access(unverified.id)).operator,false);
  await assert.rejects(()=>app.list(owner.id,null),SaasDenied);
  await assert.rejects(()=>app.summary(w.id,operator.id),SaasDenied);
  await assert.rejects(()=>app.assign(owner.id,w.id,{plan:'PRO',reason:'not authorized',validUntil:'2030-01-01T00:00:00Z'}),SaasDenied);
  await app.assign(operator.id,w.id,{plan:'PRO',reason:'manual pilot assignment',validUntil:new Date(Date.now()+86400000).toISOString()});
  assert.equal((await app.summary(w.id,owner.id)).plan,'PRO');
  assert.equal(await prisma.saasPlanChange.count({where:{workspaceId:w.id}}),1);
  await app.assign(operator.id,w.id,{plan:'STARTER',reason:'return to starter',validUntil:null});
  assert.equal((await app.summary(w.id,owner.id)).plan,'STARTER');
  assert.equal(await prisma.saasPlanChange.count({where:{workspaceId:w.id}}),2);
 }finally{
  if(id)await prisma.workspace.delete({where:{id}});
  await prisma.user.deleteMany({where:{id:{in:[operator.id,owner.id,unverified.id]}}});
  await prisma.$disconnect();
 }
});

test('PostgreSQL: Starter teacher limit blocks invitation acceptance until the plan is upgraded',async()=>{
 const nonce=randomUUID().slice(0,12);
 const old=process.env.ACADEMY_SAAS_QUOTAS_ENABLED;process.env.ACADEMY_SAAS_QUOTAS_ENABLED='true';
 const [owner,teacher]=await Promise.all([
  prisma.user.create({data:{name:'Owner',email:'quota-owner-'+nonce+'@example.invalid',emailVerified:true}}),
  prisma.user.create({data:{name:'Teacher',email:'quota-teacher-'+nonce+'@example.invalid',emailVerified:true}}),
 ]);
 let id:string|undefined;
 try{
  const w=await prisma.workspace.create({data:{slug:'quota-'+nonce,name:'Quota',type:'SOLO',members:{create:{role:'OWNER',userId:owner.id}},teachers:{create:{userId:owner.id}}}});id=w.id;
  const invite=new PrismaInvitationRepository(),now=new Date(),hash=randomUUID();
  await invite.issue(w.id,owner.id,teacher.email,'TEACHER',hash,now);
  await assert.rejects(()=>invite.accept(hash,teacher.id,teacher.email,now),InvitationLimitReached);
  assert.equal(await prisma.teacherProfile.count({where:{workspaceId:w.id}}),1);
  const admin=new SaasUseCases(new PrismaSaasRepository(new Set([owner.id])),true);
  await admin.assign(owner.id,w.id,{plan:'PRO',validUntil:new Date(Date.now()+86400000).toISOString(),reason:'Upgrade quota test'});
  await invite.accept(hash,teacher.id,teacher.email,now);
  assert.equal(await prisma.teacherProfile.count({where:{workspaceId:w.id}}),2);
 }finally{
  if(old===undefined)delete process.env.ACADEMY_SAAS_QUOTAS_ENABLED;else process.env.ACADEMY_SAAS_QUOTAS_ENABLED=old;
  if(id)await prisma.workspace.delete({where:{id}});
  await prisma.user.deleteMany({where:{id:{in:[owner.id,teacher.id]}}});
  await prisma.$disconnect();
 }
});
