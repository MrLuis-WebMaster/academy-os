import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSosReferral,InvalidSosReferral} from '../modules/learning/domain/sos-referral.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {SosReferralRepository} from '../modules/learning/application/sos-referral-ports.js';
import {SosReferralUseCases,SosReferralDenied} from '../modules/learning/application/sos-referral-use-cases.js';

test('referral validates teacher-directed question and redacts contact information',()=>{
 assert.throws(()=>parseSosReferral({courseId:'a',question:'hi'}),InvalidSosReferral);
 assert.ok(!parseSosReferral({courseId:'c',question:'Mi correo es foo@example.com; tengo una duda.'}).question.includes('foo@example.com'));
});
test('referrals separate student and teaching staff roles',async()=>{
 const calls:string[]=[];
 const membership:MembershipPort={
  hasAnyRole:async(w,u,r:readonly WorkspaceRole[])=>
   w==='a'&&r.includes(u==='student'?'STUDENT':'TEACHER'),
 };
 const row={
  id:'r',courseId:'c',studentUserId:'student',question:'¿Cómo hago este problema?',
  status:'OPEN' as const,reply:null,createdAt:new Date(),resolvedAt:null,course:{title:'Algebra'},
 };
 const repository:SosReferralRepository={
  send:async()=>{calls.push('send');return row;},
  mine:async()=>{calls.push('mine');return [row];},
  staff:async()=>{calls.push('staff');return [{...row,student:{name:'Student'}}];},
  resolve:async()=>{calls.push('resolve');return {...row,status:'RESOLVED',reply:'Revisa la primera operación.'};},
 };
 const app=new SosReferralUseCases(repository,membership);
 await assert.rejects(app.send('a','teacher',{courseId:'c',question:row.question}),SosReferralDenied);
 await assert.rejects(app.staff('a','student'),SosReferralDenied);
 await assert.rejects(app.mine('b','student'),SosReferralDenied);
 assert.deepEqual(calls,[]);
 await app.send('a','student',{courseId:'c',question:row.question});
 await app.staff('a','teacher');
 assert.deepEqual(calls,['send','staff']);
});
