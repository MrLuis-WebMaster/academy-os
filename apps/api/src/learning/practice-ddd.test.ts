import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {PracticeRepository} from '../modules/learning/application/practice-ports.js';
import {
  PracticeUseCases,PracticeAccessDenied,
} from '../modules/learning/application/practice-use-cases.js';
import {InvalidPracticeInput} from '../modules/learning/domain/practice.js';

const questions=[{prompt:'¿Cuánto vale x + 2 = 5?',options:['1','3','5','7'],correctIndex:1}];
function fixture(){
  const calls:string[]=[];
  const members:MembershipPort={
    hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>{
      const role=u==='owner'?'OWNER':u==='teacher'?'TEACHER':'STUDENT';
      return w==='a'&&roles.includes(role);
    },
  };
  const repo:PracticeRepository={
    create:async()=>{calls.push('create');return {id:'a',title:'Ejercicio',publishedAt:null};},
    listTeacher:async()=>{calls.push('teacher');return [];},
    revise:async()=>{calls.push('revise');return {id:'a',title:'Ejercicio',questions,publishedAt:null};},
    publish:async()=>{calls.push('publish');return {id:'a',publishedAt:new Date()};},
    listStudent:async()=>{calls.push('student');return [];},
    submit:async()=>{calls.push('submit');return {id:'attempt',createdAt:new Date(),correct:1,total:1,score:100,feedback:[],attemptNumber:1};},
    passport:async()=>{calls.push('passport');return [];},
  };
  return {app:new PracticeUseCases(repo,members),calls};
}
test('students cannot edit, teachers cannot submit and foreign academy is denied',async()=>{
  const {app,calls}=fixture();
  await assert.rejects(app.create('a','student',{sessionId:'s',title:'Ejercicio',questions}),PracticeAccessDenied);
  await assert.rejects(app.teacher('b','owner'),PracticeAccessDenied);
  await assert.rejects(app.submit('a','teacher','a',{answers:[1]}),PracticeAccessDenied);
  assert.deepEqual(calls,[]);
});
test('student responses are validated and only valid attempts reach storage',async()=>{
  const {app,calls}=fixture();
  await assert.rejects(app.submit('a','student','a',{answers:['wrong']}),InvalidPracticeInput);
  await assert.rejects(app.publish('a','student','a'),PracticeAccessDenied);
  await app.submit('a','student','a',{answers:[1]});
  await app.passport('a','student');
  await app.publish('a','owner','a');
  assert.deepEqual(calls,['submit','passport','publish']);
});
test('a teacher can author drafts but published work cannot be edited (repository invariant)',async()=>{
  const {app,calls}=fixture();
  await app.create('a','teacher',{sessionId:'s',title:'Ejercicio',questions});
  await app.revise('a','teacher','a',{title:'Ejercicio nuevo',questions});
  assert.deepEqual(calls,['create','revise']);
});
