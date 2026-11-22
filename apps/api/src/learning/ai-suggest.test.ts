import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSuggestion,minimizeTeachingNotes,AiSuggestionInvalid} from '../modules/learning/domain/suggestion.js';
import {SuggestClassPracticeUseCase,AiConsentRequired,AiPermissionDenied,AiProviderNotConfigured} from '../modules/learning/application/suggest-practice-use-case.js';
import type {AiPracticeRepository,PracticeAiProvider} from '../modules/learning/application/ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

const answer={title:'Ecuaciones de primer grado',questions:[
 {prompt:'¿Cuánto vale x cuando x + 3 = 7?',options:['2','3','4','5'],correctIndex:2,explanation:'Restar tres a ambos lados.'},
 {prompt:'¿Cuánto vale x cuando x - 2 = 5?',options:['7','3','5','2'],correctIndex:0,explanation:'Sumar dos a ambos lados.'},
]};
test('schema rejects hallucinated structure; redact contact info in class notes',()=>{
 assert.equal(parseSuggestion(answer).questions.length,2);
 assert.throws(()=>parseSuggestion({title:'bad',questions:[]}),AiSuggestionInvalid);
 assert.ok(!minimizeTeachingNotes('Teacher: abc@example.com +57 300 123 4567').includes('abc@example.com'));
});
function harness(role:WorkspaceRole|null,enabled=true){
 const calls:string[]=[];
 const provider:PracticeAiProvider={model:'test-model',available:()=>enabled,generate:async()=>answer};
 const memberships:MembershipPort={hasAnyRole:async(_w,_u,roles)=>Boolean(role&&roles.includes(role))};
 const repo:AiPracticeRepository={
  isAssignedTeacher:async()=>true,
  getTeacherNotes:async()=>({reflectionId:'r1',notes:'Clase de ecuaciones de primer grado.',sessionTitle:'Clase 1',subjectName:'Matemáticas'}),
  reserveDailyAttempt:async()=>{calls.push('reserve');return 'ai-1';},
  completeAttempt:async(_id,value)=>{calls.push('draft');return {id:'practice-1',title:value.title,publishedAt:null};},
  failAttempt:async()=>{calls.push('fail');},
 };
 return {cases:new SuggestClassPracticeUseCase(repo,memberships,provider),calls};
}
test('teacher-approved generation stores unpublished practice only',async()=>{
 const {cases,calls}=harness('OWNER');
 const response=await cases.execute('w','teacher','session',{approveExternalProcessing:true});
 assert.equal(response.reviewRequired,true);
 assert.equal(response.publishedAt,null);
 assert.deepEqual(calls,['reserve','draft']);
});
test('consent required and no provider call for student or disabled AI',async()=>{
 const {cases:denied}=harness('STUDENT');
 const {cases:disabled}=harness('OWNER',false);
 const {cases:accepted,calls}=harness('OWNER');
 await assert.rejects(()=>denied.execute('w','student','s',{approveExternalProcessing:true}),AiPermissionDenied);
 await assert.rejects(()=>disabled.execute('w','owner','s',{approveExternalProcessing:true}),AiProviderNotConfigured);
 await assert.rejects(()=>accepted.execute('w','owner','s',{approveExternalProcessing:false}),AiConsentRequired);
 assert.equal(calls.length,0);
});
