import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateSkillMastery,parseEvidenceInput,parseGoalInput,parseGoalStatusInput,InvalidStudentProgress,
} from '../modules/learning/domain/student-progress.js';
import {
  StudentProgressUseCases,ProgressAccessDenied,
} from '../modules/learning/application/student-progress-use-cases.js';
import type {StudentProgressRepository,LearningGoalRow} from '../modules/learning/application/student-progress-ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

test('human-evidence mastery is explicitly based on real integer scores',()=>{
  assert.deepEqual(aggregateSkillMastery([]),{mastery:0,evidenceCount:0});
  assert.deepEqual(aggregateSkillMastery([80,90,90]),{mastery:87,evidenceCount:3});
  assert.throws(()=>aggregateSkillMastery([102]),InvalidStudentProgress);
  assert.throws(()=>parseEvidenceInput({topicId:'a',studentUserId:'b',requestId:'wrong',score:50,note:'aprobado'}),InvalidStudentProgress);
  assert.deepEqual(parseGoalStatusInput({status:'ACHIEVED',reason:'Dominó el tema'}),{
    status:'ACHIEVED',reason:'Dominó el tema',
  });
  assert.throws(()=>parseGoalInput({courseId:'a',studentUserId:'b',title:'x'}),InvalidStudentProgress);
});
test('students cannot create evidence or modify goals and foreign academies are denied',async()=>{
  const called:string[]=[];
  const role:MembershipPort={
    hasAnyRole:async(workspace,user,roles:readonly WorkspaceRole[])=>
      workspace==='academy'&&roles.includes(user==='owner'?'OWNER':user==='teacher'?'TEACHER':'STUDENT'),
  };
  const goal:LearningGoalRow={
    id:'goal',courseId:'course',topicId:null,studentUserId:'student',title:'Aprender álgebra',
    description:null,targetMastery:80,targetAt:null,status:'ACTIVE',createdAt:new Date(),completedAt:null,
  };
  const repo:StudentProgressRepository={
    student:async()=>{called.push('student');return {skills:[],goals:[]};},
    course:async()=>{called.push('course');return {courseId:'course',topics:[],students:[]};},
    evidence:async()=>{called.push('evidence');return {
      id:'a',topicId:'topic',studentUserId:'student',score:90,note:'Nota válida',
      createdAt:new Date(),mastery:90,evidenceCount:1,
    };},
    evidenceHistory:async()=>{called.push('history');return [];},
    createGoal:async()=>{called.push('goal');return goal;},
    changeGoal:async()=>{called.push('change');return goal;},
  };
  const cases=new StudentProgressUseCases(repo,role);
  await assert.rejects(cases.createGoal('academy','student',{courseId:'c'}),ProgressAccessDenied);
  await assert.rejects(cases.evidence('academy','student',{topicId:'t'}),ProgressAccessDenied);
  await assert.rejects(cases.student('foreign','student'),ProgressAccessDenied);
  assert.deepEqual(called,[]);
  await cases.student('academy','student');
  await cases.course('academy','teacher','course');
  assert.deepEqual(called,['student','course']);
});
