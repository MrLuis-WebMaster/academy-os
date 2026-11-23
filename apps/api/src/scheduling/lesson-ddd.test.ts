import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {CreatedLesson,LessonListRow,LessonRepository} from '../modules/scheduling/application/lesson-ports.js';
import {
  LessonAccessDenied,LessonUseCases,
} from '../modules/scheduling/application/lesson-use-cases.js';
import {
  CompletedLessonCannotBeCancelled,InvalidLessonInput,LessonTeacherMismatch,
  ensureMayCancelLesson,parseLessonDraft,
} from '../modules/scheduling/domain/lesson.js';

const valid={
  title:'Introducción a programación',teacherProfileId:'teacher-a',mode:'ONLINE',
  startsAt:'2026-12-01T12:00:00-05:00',endsAt:'2026-12-01T13:00:00-05:00',
  meetingUrl:'https://meet.example.invalid/abc',
};
function fixture(){
  const calls:string[]=[];
  const members:MembershipPort={
    hasAnyRole:async (workspace,actor,roles:readonly WorkspaceRole[])=>{
      const role=actor==='owner'?'OWNER':actor==='admin'?'ADMIN':actor==='teacher'?'TEACHER':'STUDENT';
      return workspace==='a'&&roles.includes(role);
    },
  };
  const stub:LessonRepository={
    list:async()=>{calls.push('list');return [] as LessonListRow[];},
    create:async(_workspace,_actor,plan)=>{
      calls.push('create');
      return {
        id:'lesson-one',title:plan.title,mode:plan.mode,startsAt:plan.startsAt,
        endsAt:plan.endsAt,status:'CONFIRMED',
      } as CreatedLesson;
    },
    cancel:async(_workspace,_actor,id)=>{
      calls.push('cancel');
      return {id,status:'CANCELLED',inAppNotificationsCreated:1};
    },
  };
  return {lessons:new LessonUseCases(stub,members),calls};
}
test('lesson requests are rejected before storage for students and foreign academy actors',async()=>{
  const {lessons,calls}=fixture();
  await assert.rejects(lessons.list('a','student'),LessonAccessDenied);
  await assert.rejects(lessons.create('a','student',valid),LessonAccessDenied);
  await assert.rejects(lessons.cancel('b','owner','lesson-one'),LessonAccessDenied);
  assert.deepEqual(calls,[]);
});
test('owner, admin and teacher may use the lesson use cases',async()=>{
  const {lessons,calls}=fixture();
  const created=await lessons.create('a','teacher',valid);
  assert.equal(created.status,'CONFIRMED');
  assert.equal(created.mode,'ONLINE');
  await lessons.list('a','admin');
  assert.deepEqual(await lessons.cancel('a','owner','lesson-one'),{
    id:'lesson-one',status:'CANCELLED',inAppNotificationsCreated:1,
  });
  assert.deepEqual(calls,['create','list','cancel']);
});
test('invalid duration, mode, location and identifier fail in pure domain',async()=>{
  const {lessons,calls}=fixture();
  assert.throws(()=>parseLessonDraft({...valid,endsAt:'2026-12-01T12:00:00-05:00'}),InvalidLessonInput);
  assert.throws(()=>parseLessonDraft({...valid,endsAt:'2026-12-02T13:00:00-05:00'}),InvalidLessonInput);
  assert.throws(()=>parseLessonDraft({...valid,mode:'ONSITE',location:undefined,meetingUrl:undefined}),InvalidLessonInput);
  await assert.rejects(lessons.create('a','owner',{...valid,meetingUrl:'http://unsafe.invalid'}),InvalidLessonInput);
  await assert.rejects(lessons.cancel('a','teacher',''),InvalidLessonInput);
  assert.deepEqual(calls,[]);
});
test('teachers cannot cancel colleagues classes; completed lessons are immutable',()=>{
  assert.throws(()=>ensureMayCancelLesson('CONFIRMED','teacher-a','teacher-b',false),LessonTeacherMismatch);
  assert.throws(()=>ensureMayCancelLesson('COMPLETED','owner','teacher-a',true),CompletedLessonCannotBeCancelled);
  assert.doesNotThrow(()=>ensureMayCancelLesson('CANCELLED','teacher-a','teacher-a',false));
});
