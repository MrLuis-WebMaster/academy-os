import test from 'node:test';
import assert from 'node:assert/strict';
import type {WorkspaceProvisionRepository} from '../modules/tenancy/application/workspace-ports.js';
import {WorkspaceProvisionUseCases,WorkspaceLoginRequired} from '../modules/tenancy/application/workspace-provision-use-cases.js';
import {InvalidWorkspaceProvisioning,parseWorkspaceInput} from '../modules/tenancy/domain/workspace-provisioning.js';

const valid={type:'ACADEMY',name:'Academia Aprende',requestId:'ac29714e-beb8-47b1-90d5-2748c0fc9c89'};
test('workspace provisioning rejects invalid IDs and normalizes equivalent subject slugs',()=>{
  assert.throws(()=>parseWorkspaceInput({...valid,requestId:'invalid'}),InvalidWorkspaceProvisioning);
  const input=parseWorkspaceInput({...valid,subjects:['Física','Fisica','Inglés']});
  assert.equal(input.subjects.length,2);
});
test('workspace provisioning passes only validated drafts to its repository',async()=>{
  let called=0;
  const repo:WorkspaceProvisionRepository={
    list:async()=>[],
    provision:async(_,draft)=>{
      called++;
      return {id:'w',slug:draft.slug,name:draft.name,type:draft.type,
        timezone:draft.timezone,role:'OWNER',
      };
    },
  };
  const app=new WorkspaceProvisionUseCases(repo);
  await assert.rejects(app.list(''),WorkspaceLoginRequired);
  await assert.rejects(app.create('actor',{...valid,name:'X'}),InvalidWorkspaceProvisioning);
  const result=await app.create('actor',valid);
  assert.equal(result.role,'OWNER');
  assert.equal(called,1);
});
