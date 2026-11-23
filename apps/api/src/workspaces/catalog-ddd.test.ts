import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import {
  WorkspaceDirectoryUseCases,DirectoryAccessDenied,
} from '../modules/tenancy/application/workspace-directory.js';
import type {WorkspaceDirectoryRepository} from '../modules/tenancy/application/workspace-directory.js';
import {
  StudentClassroomUseCases,StudentClassroomAccessDenied,
} from '../modules/classroom/application/student-classroom-read.js';
import type {StudentClassroomReadRepository} from '../modules/classroom/application/student-classroom-read.js';

test('academy directory never exposes student emails to students or other academies',async()=>{
  const calls:string[]=[];
  const membership:MembershipPort={
    hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>
      w==='a'&&roles.includes(u==='owner'?'OWNER':u==='teacher'?'TEACHER':'STUDENT'),
  };
  const directory:WorkspaceDirectoryRepository={
    people:async()=>{calls.push('people');return [];},
    teachers:async()=>{calls.push('teachers');return [];},
  };
  const app=new WorkspaceDirectoryUseCases(directory,membership);
  await assert.rejects(app.people('a','student'),DirectoryAccessDenied);
  await assert.rejects(app.people('b','owner'),DirectoryAccessDenied);
  await app.teachers('a','teacher');
  await app.people('a','owner');
  assert.deepEqual(calls,['teachers','people']);
});
test('student classroom read model requires a student membership in the same workspace',async()=>{
  const calls:string[]=[];
  const membership:MembershipPort={
    hasAnyRole:async(w,u,roles)=>w==='a'&&u==='student'&&roles.includes('STUDENT'),
  };
  const repository:StudentClassroomReadRepository={
    forStudent:async(w,u)=>{calls.push(w+':'+u);return [];},
  };
  const useCase=new StudentClassroomUseCases(repository,membership);
  await assert.rejects(useCase.list('b','student'),StudentClassroomAccessDenied);
  await assert.rejects(useCase.list('a','owner'),StudentClassroomAccessDenied);
  await useCase.list('a','student');
  assert.deepEqual(calls,['a:student']);
});
