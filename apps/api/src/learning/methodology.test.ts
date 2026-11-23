import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultTeachingMethodology,methodForModel,parseTeachingMethodology,InvalidTeachingMethodology} from '../modules/learning/domain/teaching-methodology.js';
import type {TeacherMethodologyRepository} from '../modules/learning/application/methodology-ports.js';
import {TeacherMethodologyUseCases,MethodologyAccessDenied} from '../modules/learning/application/methodology-use-cases.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

test('methodology schema is strict, explicit and defaults to SOS disabled',()=>{
 assert.equal(defaultTeachingMethodology.sosEnabled,false);
 const valid={specialty:'MATHEMATICS',style:'STEP_BY_STEP',language:'es',guidance:'Da pistas breves',sosEnabled:true};
 const parsed=parseTeachingMethodology(valid);
 assert.equal(methodForModel(parsed).style,'Divide la explicación en pasos verificables.');
 assert.throws(()=>parseTeachingMethodology({...valid,apiKey:'secreto'}),InvalidTeachingMethodology);
 assert.throws(()=>parseTeachingMethodology({...valid,guidance:'x'.repeat(1201)}),InvalidTeachingMethodology);
});
test('only managers or teachers reach their teaching method repository',async()=>{
 let reads=0;
 const members:MembershipPort={hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>
  w==='academy'&&roles.includes(u==='owner'?'OWNER':u==='teacher'?'TEACHER':'STUDENT'),
 };
 const repo:TeacherMethodologyRepository={
  read:async()=>{reads++;return {...defaultTeachingMethodology};},
  save:async(_,__,___,value)=>{reads++;return value;},
 };
 const useCases=new TeacherMethodologyUseCases(repo,members);
 await assert.rejects(useCases.read('other','owner','t1'),MethodologyAccessDenied);
 await assert.rejects(useCases.save('academy','student','t1',{}),MethodologyAccessDenied);
 assert.equal(reads,0);
 await useCases.read('academy','teacher','t1');
 assert.equal(reads,1);
});
