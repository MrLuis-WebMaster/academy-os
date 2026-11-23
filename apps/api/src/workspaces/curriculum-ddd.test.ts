import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {CurriculumRepository} from '../modules/academics/application/curriculum-ports.js';
import {
  CurriculumUseCases,CurriculumAccessDenied,
} from '../modules/academics/application/curriculum-use-cases.js';
import {InvalidCurriculumInput} from '../modules/academics/domain/curriculum.js';

function fixture(){
  const calls:string[]=[];
  const membership:MembershipPort={
    hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>
      w==='a'&&roles.includes(u==='owner'?'OWNER':u==='teacher'?'TEACHER':'STUDENT'),
  };
  const repository:CurriculumRepository={
    show:async(_w,_u,courseId)=>{calls.push('show');return {courseId,topics:[],teachers:[]};},
    assign:async(_w,_u,courseId,teacherId)=>{calls.push('assign');return {courseId,teacherId};},
    unassign:async(_w,_u,courseId,teacherId)=>{
      calls.push('unassign');return {courseId,teacherId,assigned:false};
    },
    createTopic:async(_w,_u,courseId,input)=>{
      calls.push('topic');return {
        id:'topic',courseId,title:input.title,order:input.order,parentId:input.parentId??null,
      };
    },
  };
  return {cases:new CurriculumUseCases(repository,membership),calls};
}
test('students and other academies cannot inspect or change the curriculum',async()=>{
  const {cases,calls}=fixture();
  await assert.rejects(cases.show('a','student','course'),CurriculumAccessDenied);
  await assert.rejects(cases.assign('foreign','owner','course',{teacherId:'teacher'}),CurriculumAccessDenied);
  await assert.rejects(cases.createTopic('a','student','course',{title:'Álgebra'}),CurriculumAccessDenied);
  assert.deepEqual(calls,[]);
});
test('teacher cannot assign teachers, and invalid topic/teacher is rejected',async()=>{
  const {cases,calls}=fixture();
  await assert.rejects(cases.assign('a','teacher','course',{teacherId:'teacher'}),CurriculumAccessDenied);
  await assert.rejects(cases.assign('a','owner','course',{teacherId:''}),InvalidCurriculumInput);
  await assert.rejects(cases.createTopic('a','owner','course',{title:'x'}),InvalidCurriculumInput);
  await cases.show('a','teacher','course');
  await cases.createTopic('a','teacher','course',{title:'Álgebra'});
  assert.deepEqual(calls,['show','topic']);
});
