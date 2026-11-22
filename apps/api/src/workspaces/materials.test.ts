import test from 'node:test';
import assert from 'node:assert/strict';
import {
  externalResourceInput,parseExternalMaterial,parseMaterialId,parsePublication,
  ensurePublishableMaterial,InvalidMaterialInput,MaterialNotPublishable,
} from '../modules/classroom/domain/material.js';
import {MaterialUseCases,MaterialAccessDenied} from '../modules/classroom/application/material-use-cases.js';
import type {MaterialRepository,ManagedMaterial,CreatedMaterial} from '../modules/classroom/application/ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

test('accepts a published HTTPS material reference',()=>{
  assert.equal(externalResourceInput.safeParse({courseId:'course-1',title:'Guía de ecuaciones',url:'https://example.com/doc',published:true}).success,true);
});
test('rejects javascript, http and file URLs',()=>{
  for(const url of ['javascript:alert(1)','http://example.com','file:///etc/passwd']){
    assert.equal(externalResourceInput.safeParse({courseId:'course-1',title:'Guía de ecuaciones',url}).success,false);
  }
});
test('requires an explicit course and defaults to unpublished',()=>{
  const result=externalResourceInput.safeParse({courseId:'course-1',title:'Recursos de inglés',url:'https://example.com'});
  assert.equal(result.success,true);
  if(result.success)assert.equal(result.data.published,false);
  assert.throws(()=>parseExternalMaterial({courseId:'c',title:'Hi',url:'http://example.com'}),InvalidMaterialInput);
});
test('publication requires a boolean; non-HTTPS/connected resources cannot be published',()=>{
  assert.equal(parsePublication({published:true}),true);
  assert.equal(parsePublication({published:false}),false);
  assert.throws(()=>parsePublication({published:'true'}),InvalidMaterialInput);
  assert.throws(()=>parseMaterialId(''),InvalidMaterialInput);
  assert.throws(()=>ensurePublishableMaterial({source:'GOOGLE_DRIVE',courseId:'c',url:'https://example.com',courseWorkspaceId:'a'}),MaterialNotPublishable);
  assert.throws(()=>ensurePublishableMaterial({source:'EXTERNAL_URL',courseId:'c',url:'http://example.com',courseWorkspaceId:'a'}),MaterialNotPublishable);
  assert.doesNotThrow(()=>ensurePublishableMaterial({source:'EXTERNAL_URL',courseId:'c',url:'https://example.com',courseWorkspaceId:'a'}));
});

function fixture(){
  const calls:string[]=[];
  const members:MembershipPort={
    hasAnyRole:async (w,u,roles:readonly WorkspaceRole[])=>
      w==='academy-a'&&roles.some(role=>role===(u==='owner'?'OWNER':u==='admin'?'ADMIN':'STUDENT')),
  };
  const list:ManagedMaterial[]=[];
  const repo:MaterialRepository={
    listByWorkspace:async()=>{calls.push('list');return list;},
    create:async (_workspace,_actor,input)=>{
      calls.push('create');
      const material:CreatedMaterial={id:'material-a',title:input.title,url:input.url,courseId:input.courseId,published:input.published};
      return material;
    },
    setPublished:async (_workspace,_actor,id,published)=>{calls.push('publish');return {id,published};},
  };
  return {materials:new MaterialUseCases(repo,members),calls};
}
test('students and other academies cannot manage or list drafts',async()=>{
  const {materials,calls}=fixture();
  const input={courseId:'course-a',title:'Ejercicios',url:'https://example.com/guide'};
  await assert.rejects(materials.list('academy-a','student'),MaterialAccessDenied);
  await assert.rejects(materials.create('academy-b','owner',input),MaterialAccessDenied);
  await assert.rejects(materials.setPublished('academy-a','student','material-a',{published:true}),MaterialAccessDenied);
  assert.deepEqual(calls,[]);
});
test('owners/admins can create drafts and change their publication; invalid input never reaches repository',async()=>{
  const {materials,calls}=fixture();
  const created=await materials.create('academy-a','owner',{courseId:'course-a',title:'Ejercicios',url:'https://example.com/guide'});
  assert.equal(created.published,false);
  await assert.rejects(materials.create('academy-a','admin',{courseId:'course-a',title:'No',url:'https://example.com'}),InvalidMaterialInput);
  assert.deepEqual(await materials.setPublished('academy-a','admin','material-a',{published:true}),{id:'material-a',published:true});
  assert.deepEqual(calls,['create','publish']);
});
