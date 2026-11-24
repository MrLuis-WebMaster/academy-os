import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {PrismaPackageOrderRepository} from '../modules/commerce/infrastructure/prisma-package-order-repository.js';
import {parseCreateOrder,parseReviewOrder,InvalidOrderInput,OrderConflict,OrderMissing} from '../modules/commerce/domain/package-order.js';
test('order input cannot supply credits or bypass payment confirmation',()=>{
 assert.throws(()=>parseCreateOrder({packageId:'p',requestId:randomUUID(),expectedPriceCOP:100,credits:99}),InvalidOrderInput);
 assert.throws(()=>parseReviewOrder({action:'fulfill',amountCOP:100,paymentReference:'test',note:'verified',confirmedExternalPayment:false}),InvalidOrderInput);
 const result=parseReviewOrder({action:'fulfill',amountCOP:100,paymentReference:'abc-123',note:'verified payment',confirmedExternalPayment:true});
 assert.equal(result.action==='fulfill'&&result.paymentReference,'ABC-123');
});
test('PostgreSQL: purchase fulfillment issues credits once, validates price and isolates tenants',async()=>{
 const nonce=randomUUID().slice(0,12);
 const users=await Promise.all(['owner','student','other'].map(name=>prisma.user.create({data:{name,email:'order-'+name+'-'+nonce+'@example.invalid'}})));
 const [owner,student,other]=users;assert.ok(owner&&student&&other);
 const ids:string[]=[];
 try{
  const a=await prisma.workspace.create({data:{name:'Orders A',slug:'order-a-'+nonce,type:'ACADEMY',members:{create:[{userId:owner.id,role:'OWNER'},{userId:student.id,role:'STUDENT'},{userId:other.id,role:'STUDENT'}]}}});ids.push(a.id);
  const b=await prisma.workspace.create({data:{name:'Orders B',slug:'order-b-'+nonce,type:'ACADEMY',members:{create:{userId:owner.id,role:'OWNER'}}}});ids.push(b.id);
  const course=await prisma.course.create({data:{workspaceId:a.id,title:'English'}});
  await prisma.enrollment.create({data:{courseId:course.id,userId:student.id}});
  const plan=await prisma.classPackage.create({data:{workspaceId:a.id,title:'Four classes',courseId:course.id,courseRestricted:true,sessionCredits:4,priceCOP:100000,validDays:30}});
  const repo=new PrismaPackageOrderRepository();
  assert.equal((await repo.catalog(a.id,student.id)).length,1);
  assert.equal((await repo.catalog(a.id,other.id)).length,0);
  const input={packageId:plan.id,requestId:randomUUID(),expectedPriceCOP:100000};
  await assert.rejects(()=>repo.create(a.id,student.id,{...input,expectedPriceCOP:1}),OrderConflict);
  await assert.rejects(()=>repo.create(a.id,other.id,input),OrderMissing);
  const order=await repo.create(a.id,student.id,input);
  assert.equal((await repo.create(a.id,student.id,input)).id,order.id);
  assert.equal(await prisma.classPackageEntitlement.count({where:{workspaceId:a.id}}),0);
  const review={action:'fulfill',amountCOP:100000,paymentReference:'REFERENCE-'+nonce,confirmedExternalPayment:true,note:'External payment verified'} as const;
  await assert.rejects(()=>repo.review(b.id,owner.id,order.id,review),OrderMissing);
  await assert.rejects(()=>repo.review(a.id,owner.id,order.id,{...review,amountCOP:1}),OrderConflict);
  const [first,second]=await Promise.all([repo.review(a.id,owner.id,order.id,review),repo.review(a.id,owner.id,order.id,review)]);
  assert.equal(first.entitlementId,second.entitlementId);assert.equal(first.status,'FULFILLED');
  assert.equal(await prisma.classPackageEntitlement.count({where:{workspaceId:a.id}}),1);
  const next=await repo.create(a.id,student.id,{...input,requestId:randomUUID()});
  await assert.rejects(()=>repo.review(a.id,owner.id,next.id,review),OrderConflict);
  assert.equal((await repo.cancel(a.id,student.id,next.id)).status,'CANCELLED');
  assert.equal((await repo.mine(a.id,other.id)).length,0);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:ids}}});
  await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
  await prisma.$disconnect();
 }
});
