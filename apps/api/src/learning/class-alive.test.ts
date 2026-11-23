import test from 'node:test';
import assert from 'node:assert/strict';
import {noteInput,parseReflectionNotes,InvalidClassReflection} from '../modules/learning/domain/class-reflection.js';
import {
  ReflectionUseCases,ReflectionAccessDenied,
} from '../modules/learning/application/reflection-use-cases.js';
import type {ReflectionRepository} from '../modules/learning/application/reflection-ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

test('notes require meaningful teacher reflection',()=>{
  assert.equal(noteInput.safeParse({notes:'Muy corto'}).success,false);
  assert.equal(noteInput.safeParse({notes:'Hoy practicamos funciones y repasamos conceptos esenciales de JavaScript.'}).success,true);
});
test('notes reject huge payloads',()=>{
  assert.equal(noteInput.safeParse({notes:'x'.repeat(12001)}).success,false);
  assert.throws(()=>parseReflectionNotes({notes:'x'.repeat(12001)}),InvalidClassReflection);
});
test('a student or another academy cannot create or read draft notes',async()=>{
  const calls:string[]=[];
  const member:MembershipPort={
    hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>{
      const role=u==='owner'?'OWNER':u==='teacher'?'TEACHER':'STUDENT';
      return w==='a'&&roles.includes(role);
    },
  };
  const repo:ReflectionRepository={
    listStaff:async()=>{calls.push('listStaff');return [];},
    listStudent:async()=>{calls.push('listStudent');return [];},
    save:async(_w,_u,sessionId,notes)=>{calls.push('save');return {id:'note-a',sessionId,notes,status:'DRAFT'};},
    publish:async()=>{calls.push('publish');return {id:'note-a',status:'PUBLISHED',approvedAt:new Date()};},
  };
  const app=new ReflectionUseCases(repo,member);
  await assert.rejects(app.save('a','student','session',{notes:'Enough notes about the learning experience'}),ReflectionAccessDenied);
  await assert.rejects(app.publish('b','owner','session'),ReflectionAccessDenied);
  await assert.rejects(app.listStaff('a','student'),ReflectionAccessDenied);
  await assert.rejects(app.listStudent('a','teacher'),ReflectionAccessDenied);
  assert.deepEqual(calls,[]);
  const saved=await app.save('a','teacher','session',{notes:'Enough notes about the learning experience'});
  assert.equal(saved.status,'DRAFT');
  assert.equal((await app.publish('a','owner','session')).status,'PUBLISHED');
});
