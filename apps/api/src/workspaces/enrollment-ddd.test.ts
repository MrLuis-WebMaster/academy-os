import test from 'node:test';
import assert from 'node:assert/strict';
import {EnrollmentUseCases,EnrollmentExists,InvalidEnrollmentScope,EnrollmentNotFound} from '../modules/academics/application/enrollment-use-cases.js';
import {SubjectAccessDenied} from '../modules/academics/application/subject-use-cases.js';
import {enrollmentCommand,InvalidEnrollment} from '../modules/academics/domain/enrollment.js';
import type {EnrollmentRepository} from '../modules/academics/application/enrollment-ports.js';
import type {MembershipPort} from '../modules/academics/application/ports.js';

function harness(allowed:boolean) {
  const rows=new Set<string>();
  const members:MembershipPort={
    hasAnyRole:async()=>allowed,
  };
  const repository:EnrollmentRepository={
    courseExists:async(workspace,course)=>workspace==='my-academy'&&course==='course-1',
    studentIsMember:async(workspace,student)=>workspace==='my-academy'&&student==='student-1',
    async add(_workspace,courseId,userId) {
      const key=courseId+':'+userId;
      if(rows.has(key))throw new EnrollmentExists();
      rows.add(key);
      return {id:key,courseId,userId,createdAt:new Date(0)};
    },
    async remove(_w,c,u) {return rows.delete(c+':'+u);},
  };
  return {cases:new EnrollmentUseCases(repository,members),rows};
}
test('enrollment command rejects malformed identifiers',()=>{
 assert.deepEqual(enrollmentCommand({courseId:' course-1 ',studentUserId:' student-1 '}),{courseId:'course-1',studentUserId:'student-1'});
 assert.throws(()=>enrollmentCommand({courseId:'',studentUserId:'one'}),InvalidEnrollment);
 assert.throws(()=>enrollmentCommand(null),InvalidEnrollment);
});
test('owner can enrol, duplicate cannot, unenrol is idempotency-aware',async()=>{
 const {cases,rows}=harness(true);
 const cmd={courseId:'course-1',studentUserId:'student-1'};
 await cases.enroll('my-academy','admin',cmd);
 assert.equal(rows.size,1);
 await assert.rejects(()=>cases.enroll('my-academy','admin',cmd),EnrollmentExists);
 await cases.unenroll('my-academy','admin',cmd);
 assert.equal(rows.size,0);
 await assert.rejects(()=>cases.unenroll('my-academy','admin',cmd),EnrollmentNotFound);
});
test('deny other academies and unauthorized operators',async()=>{
 const {cases}=harness(true);
 const {cases:outsider}=harness(false);
 await assert.rejects(()=>cases.enroll('another','admin',{courseId:'course-1',studentUserId:'student-1'}),InvalidEnrollmentScope);
 await assert.rejects(()=>outsider.enroll('my-academy','intruder',{courseId:'course-1',studentUserId:'student-1'}),SubjectAccessDenied);
});
