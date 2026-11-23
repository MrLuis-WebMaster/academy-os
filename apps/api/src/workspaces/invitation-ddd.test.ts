import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {InvitationRepository,InvitationTokenPort} from '../modules/tenancy/application/invitation-ports.js';
import {
  InvitationUseCases,InvitationAccessDenied,InvitationRoleDenied,
} from '../modules/tenancy/application/invitation-use-cases.js';
import {InvalidInvitation,parseInvitation,parseInvitationToken} from '../modules/tenancy/domain/invitation.js';

function fixture(){
  const calls:string[]=[];
  const members:MembershipPort={
    hasAnyRole:async (workspace,user,roles:readonly WorkspaceRole[])=>{
      const role=user==='owner'?'OWNER':user==='admin'?'ADMIN':'STUDENT';
      return workspace==='academy'&&roles.includes(role);
    },
  };
  const tokens:InvitationTokenPort={
    mint:()=>({token:'a'.repeat(43),hash:'hash-a'}),digest:()=> 'hash-a',
  };
  const repo:InvitationRepository={
    issue:async (_w,_u,email,role)=>{calls.push('issue');return {id:'invite',email,role,expiresAt:new Date()};},
    accept:async()=>{calls.push('accept');return {workspaceId:'academy',role:'STUDENT'};},
  };
  return {app:new InvitationUseCases(repo,members,tokens),calls};
}
test('invitations normalize email and reject malformed roles/tokens',()=>{
  assert.deepEqual(parseInvitation({email:'ALICE@EXAMPLE.COM',role:'STUDENT'}),{
    email:'alice@example.com',role:'STUDENT',
  });
  assert.throws(()=>parseInvitation({email:'alice@example.com',role:'OWNER'}),InvalidInvitation);
  assert.throws(()=>parseInvitationToken({token:'a'}),InvalidInvitation);
});
test('student actors and cross-workspace actors cannot invite members',async()=>{
  const {app,calls}=fixture();
  await assert.rejects(app.issue('academy','student',{email:'alice@example.com',role:'STUDENT'}),InvitationAccessDenied);
  await assert.rejects(app.issue('foreign','owner',{email:'alice@example.com',role:'STUDENT'}),InvitationAccessDenied);
  assert.deepEqual(calls,[]);
});
test('admins cannot invite admins, owners may invite, and accepting invokes the repository',async()=>{
  const {app,calls}=fixture();
  await assert.rejects(app.issue('academy','admin',{email:'alice@example.com',role:'ADMIN'}),InvitationRoleDenied);
  const issued=await app.issue('academy','owner',{email:'Alice@Example.com',role:'ADMIN'});
  assert.equal(issued.email,'alice@example.com');
  assert.equal(issued.token.length,43);
  assert.deepEqual(await app.accept('alice','ALICE@example.com',{token:'a'.repeat(43)}),{
    workspaceId:'academy',role:'STUDENT',
  });
  assert.deepEqual(calls,['issue','accept']);
});
