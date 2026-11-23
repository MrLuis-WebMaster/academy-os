import test from 'node:test';
import assert from 'node:assert/strict';
import {SuggestLearningAssetUseCase} from '../modules/learning/application/suggest-learning-asset.js';
import {AiConsentRequired,AiPermissionDenied} from '../modules/learning/application/suggest-practice-use-case.js';
import type {AiLearningAssetsRepository,LearningAssetAiProvider} from '../modules/learning/application/ai-learning-asset-ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

test('AI suggestions for flashcards are draft-only, with minimized teacher notes and consent',async()=>{
 const called:string[]=[];
 const notes={reflectionId:'r1',notes:'Clases sobre was y were. Alumno foo@example.com.',
  sessionTitle:'Past simple',subjectName:'English'};
 const repo:AiLearningAssetsRepository={
  isAssignedTeacher:async()=>true,
  teacherNotes:async()=>notes,
  reserveDailyAttempt:async()=>{called.push('reserve');return 'g1';},
  completeDraft:async(_w,_u,_session,_generation,_reflection,draft)=>{
   called.push('save');assert.equal(draft.kind,'FLASHCARDS');
   assert.equal(draft.title,'Was and were');
   return {id:'asset-1',title:draft.title,kind:draft.kind,publishedAt:null};
  },
  failAttempt:async()=>{called.push('fail');},
 };
 const provider:LearningAssetAiProvider={
  model:'mock',available:()=>true,
  propose:async input=>{
   called.push('generate');
   assert.equal(input.kind,'FLASHCARDS');
   assert.equal(input.notes.includes('foo@example.com'),false);
   return {title:'Was and were',content:{cards:[
    {front:'When is was used?',back:'For I, he, she, it'},
    {front:'When is were used?',back:'For you, we, they'},
   ]}};
  },
 };
 const members:MembershipPort={
  hasAnyRole:async(_w,user,roles:readonly WorkspaceRole[])=>
   roles.includes(user==='teacher'?'TEACHER':'STUDENT'),
 };
 const useCases=new SuggestLearningAssetUseCase(repo,members,provider);
 await assert.rejects(()=>useCases.execute('w','student','s',{
  kind:'FLASHCARDS',approveExternalProcessing:true,
 }),AiPermissionDenied);
 await assert.rejects(()=>useCases.execute('w','teacher','s',{
  kind:'FLASHCARDS',approveExternalProcessing:false,
 }),AiConsentRequired);
 assert.deepEqual(called,[]);
 const result=await useCases.execute('w','teacher','s',{
  kind:'FLASHCARDS',approveExternalProcessing:true,
 });
 assert.equal(result.publishedAt,null);assert.equal(result.reviewRequired,true);
 assert.deepEqual(called,['reserve','generate','save']);
});
