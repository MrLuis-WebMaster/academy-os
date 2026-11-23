import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {GuardianRepository} from '../modules/tenancy/application/guardian-ports.js';
import {GuardianUseCases,GuardianAccessDenied} from '../modules/tenancy/application/guardian-use-cases.js';
import {InvalidGuardianLink,parseGuardianApproval,parseGuardianLink} from '../modules/tenancy/domain/guardian-link.js';
import {inviteInput} from '../modules/tenancy/domain/invitation.js';

test('guardian invitations are valid, but enrollment in GUARDIAN role does not automatically authorize a student',()=>{
  assert.equal(inviteInput.safeParse({email:'parent@example.com',role:'GUARDIAN'}).success,true);
  assert.throws(()=>parseGuardianLink({guardianUserId:'same',studentUserId:'same'}),InvalidGuardianLink);
  assert.throws(()=>parseGuardianApproval({
    verificationConfirmed:false,method:'IN_PERSON',verificationNote:'Un familiar estuvo presente',
  }),InvalidGuardianLink);
});
test('managers approve family links; guardians can only read approved students',async()=>{
  const calls:string[]=[];
  const member:MembershipPort={
    hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>{
      const role=u==='owner'?'OWNER':u==='guardian'?'GUARDIAN':'STUDENT';
      return w==='academy'&&roles.includes(role);
    },
  };
  const repo:GuardianRepository={
    links:async()=>{calls.push('links');return [];},
    start:async()=>{calls.push('start');return {id:'link',status:'PENDING'};},
    approve:async()=>{calls.push('approve');return {id:'link',status:'ACTIVE',approvedAt:new Date()};},
    revoke:async()=>{calls.push('revoke');return {id:'link',status:'REVOKED'};},
    students:async()=>{calls.push('students');return [];},
    overview:async()=>{calls.push('overview');return {student:{id:'student',name:'Student'},courses:[]};},
  };
  const app=new GuardianUseCases(repo,member);
  await assert.rejects(app.start('academy','guardian',{guardianUserId:'g',studentUserId:'s'}),GuardianAccessDenied);
  await assert.rejects(app.overview('other','guardian','s'),GuardianAccessDenied);
  await assert.rejects(app.approve('academy','guardian','link',{
    verificationConfirmed:true,method:'IN_PERSON',verificationNote:'Identidad cotejada en persona',
  }),GuardianAccessDenied);
  assert.deepEqual(calls,[]);
  const pending=await app.start('academy','owner',{guardianUserId:'g',studentUserId:'s'});
  assert.equal(pending.status,'PENDING');
  await app.students('academy','guardian');
  assert.deepEqual(calls,['start','students']);
});
