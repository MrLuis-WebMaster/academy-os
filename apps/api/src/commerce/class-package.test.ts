import test from 'node:test';
import assert from 'node:assert/strict';
import {grantExpiry,parsePackagePlan,InvalidPackageInput,remainingCredits} from '../modules/commerce/domain/class-package.js';
import type {ClassPackagesRepository,PackagePlanView,PackageEntitlementView} from '../modules/commerce/application/package-ports.js';
import {ClassPackagesUseCases,PackageAccessDenied} from '../modules/commerce/application/package-use-cases.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
test('package schema rejects impossible offers and never assumes a payment',()=>{
 const plan=parsePackagePlan({title:'4 clases',sessionCredits:4,validDays:30,priceCOP:160000});
 assert.equal(plan.sessionCredits,4);
 assert.equal(grantExpiry(new Date('2026-10-01T00:00:00Z'),30).toISOString(),'2026-10-31T00:00:00.000Z');
 assert.equal(remainingCredits(4,2),2);
 assert.throws(()=>parsePackagePlan({...plan,sessionCredits:0}),InvalidPackageInput);
 assert.throws(()=>parsePackagePlan({...plan,discountCode:'hack'}),InvalidPackageInput);
});
test('teacher and student cannot issue credits, owner cannot read student entitlements',async()=>{
 const calls:string[]=[];
 const members:MembershipPort={hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>
  w==='a'&&roles.includes(u==='owner'?'OWNER':u==='student'?'STUDENT':'TEACHER'),
 };
 const plan:PackagePlanView={id:'p',title:'4 clases',courseId:null,sessionCredits:4,priceCOP:160000,validDays:30,active:true,createdAt:new Date()};
 const view:PackageEntitlementView={id:'g',packageId:'p',studentUserId:'student',credits:4,used:0,remaining:4,activeBookingIds:[],expiresAt:new Date(),issuedAt:new Date(),revokedAt:null,package:{title:'4 clases',courseId:null,priceCOP:160000}};
 const repo:ClassPackagesRepository={
  plans:async()=>{calls.push('plans');return [plan];},
  create:async()=>{calls.push('create');return plan;},
  setActive:async()=>{calls.push('active');return plan;},
  issue:async()=>{calls.push('issue');return view;},
  mine:async()=>{calls.push('mine');return [view];},
  redeem:async()=>{calls.push('redeem');return {id:'r',bookingId:'b',entitlementId:'g',remaining:3,alreadyRedeemed:false};},
 };
 const app=new ClassPackagesUseCases(repo,members);
 await assert.rejects(()=>app.issue('a','teacher','p',{studentUserId:'student',requestId:'e4a4ca49-7207-4e99-bd8a-a41d22d44ed7'}),PackageAccessDenied);
 await assert.rejects(()=>app.issue('b','owner','p',{studentUserId:'student'}),PackageAccessDenied);
 await assert.rejects(()=>app.mine('a','owner'),PackageAccessDenied);
 assert.deepEqual(calls,[]);
 await app.create('a','owner',{title:'4 clases',sessionCredits:4,priceCOP:160000,validDays:30});
 assert.equal((await app.mine('a','student'))[0]?.remaining,4);
});
