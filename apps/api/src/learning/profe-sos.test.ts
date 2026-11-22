import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedTutorResponse} from '../modules/learning/domain/tutor-answer.js';
import {AskProfeSosUseCase,TutorNotAllowed,TutorWithoutEvidence} from '../modules/learning/application/ask-profe-sos-use-case.js';
import type {StudentTutoringRepository,TutorProvider} from '../modules/learning/application/tutor-ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

const evidence=[{id:'s1',title:'Clase de fracciones',notes:'Hoy estudiamos numeradores y denominadores.'}];
test('tutor does not trust fabricated citations',()=>{
 const result=validatedTutorResponse({answer:'Repasa el numerador.',evidenceIds:['unknown'],referToTeacher:false},evidence);
 assert.equal(result.sources.length,0);
 assert.equal(result.referToTeacher,true);
});
test('tutor uses only own enrolled course and approved notes',async()=>{
 const calls:string[]=[];
 const repository:StudentTutoringRepository={
  enrolled:async(_w,_u,c)=>c==='my-course',
  publishedEvidence:async()=>evidence,
  reserveDailyAttempt:async()=>{calls.push('reserve');return 'g1';},
  finishAttempt:async()=>{calls.push('complete');},
  failAttempt:async()=>{calls.push('fail');},
 };
 const provider:TutorProvider={
  model:'test',available:()=>true,
  answer:async(q,notes)=>{
    assert.equal(q,'¿Qué es un numerador?');
    assert.equal(notes.length,1);
    return {answer:'El numerador cuenta las partes.',evidenceIds:['s1'],referToTeacher:false};
  },
 };
 const membership:MembershipPort={hasAnyRole:async(_w,_u,r:readonly WorkspaceRole[])=>r.includes('STUDENT')};
 const cases=new AskProfeSosUseCase(repository,membership,provider);
 const response=await cases.execute('w','student',{courseId:'my-course',question:'¿Qué es un numerador?',approveExternalProcessing:true});
 assert.equal(response.sources[0].id,'s1');
 assert.deepEqual(calls,['reserve','complete']);
 await assert.rejects(()=>cases.execute('w','student',{courseId:'other',question:'¿Qué es un numerador?',approveExternalProcessing:true}),TutorNotAllowed);
});
test('tutor refuses to invent evidence when no class notes exist',async()=>{
 const repo:StudentTutoringRepository={
  enrolled:async()=>true,publishedEvidence:async()=>[],reserveDailyAttempt:async()=>{throw Error('should not call');},
  finishAttempt:async()=>{},failAttempt:async()=>{},
 };
 const provider:TutorProvider={model:'mock',available:()=>true,answer:async()=>({})};
 const membership:MembershipPort={hasAnyRole:async()=>true};
 const cases=new AskProfeSosUseCase(repo,membership,provider);
 await assert.rejects(()=>cases.execute('w','student',{courseId:'c1',question:'¿Dónde están las notas?',approveExternalProcessing:true}),TutorWithoutEvidence);
});
