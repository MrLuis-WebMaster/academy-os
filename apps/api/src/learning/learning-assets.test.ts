import test from 'node:test';
import assert from 'node:assert/strict';
import {InvalidLearningAsset,parseLearningAsset,parseLearningAssetRevision} from '../modules/learning/domain/learning-asset.js';
import type {LearningAssetsRepository,LearningAssetView} from '../modules/learning/application/learning-assets-ports.js';
import {LearningAssetsUseCases,LearningAssetDenied} from '../modules/learning/application/learning-assets-use-cases.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

test('teacher-authored flashcard decks and micro-lessons have strict content and length limits',()=>{
 const cards=parseLearningAsset({sessionId:'s',kind:'FLASHCARDS',title:'Expresiones en inglés',
  content:{cards:[{front:'Good morning',back:'Buenos días'},{front:'Good evening',back:'Buenas noches'}]}});
 assert.equal(cards.kind,'FLASHCARDS');
 const lesson=parseLearningAsset({
  sessionId:'s',kind:'MICROLESSON',title:'La negación en pasado',
  content:{summary:'Aprendimos a usar did not para expresar la negación en pasado simple.',
   steps:[{heading:'Negación',body:'Para negar en pasado usamos did not antes del verbo en infinitivo.'}]},
 });
 assert.equal(lesson.kind,'MICROLESSON');
 assert.throws(()=>parseLearningAsset({sessionId:'s',kind:'FLASHCARDS',title:'Bad',content:{cards:[{front:'Hi',back:'Hola'}]}}),InvalidLearningAsset);
 assert.throws(()=>parseLearningAssetRevision('FLASHCARDS',{title:'X',content:{cards:[]}}),InvalidLearningAsset);
});
test('students cannot create study resources; only authorized staff can propose unpublished drafts',async()=>{
 const calls:string[]=[];
 const memberships:MembershipPort={
  hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>
   w==='a'&&roles.includes(u==='student'?'STUDENT':'OWNER'),
 };
 const row:LearningAssetView={
  id:'a1',kind:'FLASHCARDS',title:'Verbos',
  content:{cards:[{front:'Present',back:'Presente'},{front:'Past',back:'Pasado'}]},
  publishedAt:null,reflection:{sessionId:'s',status:'DRAFT',session:{title:'Lección',courseId:'c'}},
 };
 const repo:LearningAssetsRepository={
  create:async()=>{calls.push('create');return row;},
  staff:async()=>{calls.push('staff');return [row];},
  revise:async()=>{calls.push('revise');return row;},
  publish:async()=>{calls.push('publish');return row;},
  student:async()=>{calls.push('student');return [];},
 };
 const useCases=new LearningAssetsUseCases(repo,memberships);
 await assert.rejects(()=>useCases.create('a','student',{
  sessionId:'s',kind:'FLASHCARDS',title:'Verbos',content:row.content,
 }),LearningAssetDenied);
 assert.deepEqual(calls,[]);
 await useCases.create('a','owner',{sessionId:'s',kind:'FLASHCARDS',title:'Verbos',content:row.content});
 assert.deepEqual(calls,['create']);
});
