import test from 'node:test';
import assert from 'node:assert/strict';
import {CourseUseCases,CourseSubjectOutsideWorkspace} from '../modules/academics/application/course-use-cases.js';
import {SubjectAccessDenied} from '../modules/academics/application/subject-use-cases.js';
import {InvalidCourseDetails} from '../modules/academics/domain/course-draft.js';
import type {CourseRepository,CourseCreated} from '../modules/academics/application/course-ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

function context(allow:boolean){
  const rows:CourseCreated[]=[];
  const access:MembershipPort={hasAnyRole:async(_w:string,_u:string,_r:readonly WorkspaceRole[])=>allow};
  const repo:CourseRepository={
    async listByWorkspace(){return rows.map(r=>({...r,published:false,subject:null}));},
    async subjectExists(_workspace,subject){return subject==='valid-subject';},
    async create(_workspace,draft){
      const row={id:'id-'+(rows.length+1),title:draft.title,summary:draft.summary??null,subjectId:draft.subjectId??null};
      rows.push(row);return row;
    },
  };
  return {useCases:new CourseUseCases(repo,access),rows};
}
test('course title and summary are domain validated',async()=>{
 const {useCases}=context(true);
 await assert.rejects(()=>useCases.create('w1','u1',{title:' x '}),InvalidCourseDetails);
 await assert.rejects(()=>useCases.create('w1','u1',{title:'Álgebra',summary:'x'.repeat(2001)}),InvalidCourseDetails);
});
test('a course can belong to an authorized subject or exist as free tutoring',async()=>{
 const {useCases,rows}=context(true);
 const first=await useCases.create('w1','u1',{title:'Aprende Matemáticas',subjectId:'valid-subject'});
 const second=await useCases.create('w1','u1',{title:'Tutoría personalizada'});
 assert.equal(first.subjectId,'valid-subject');
 assert.equal(second.subjectId,null);
 assert.equal(rows.length,2);
 await assert.rejects(()=>useCases.create('w1','u1',{title:'Tutoría musical',subjectId:'other-tenant'}),CourseSubjectOutsideWorkspace);
});
test('application port refuses unauthorized read and write',async()=>{
 const {useCases,rows}=context(false);
 await assert.rejects(()=>useCases.create('w1','intruder',{title:'Literatura'}),SubjectAccessDenied);
 await assert.rejects(()=>useCases.list('w1','intruder'),SubjectAccessDenied);
 assert.equal(rows.length,0);
});
