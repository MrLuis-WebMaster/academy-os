import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {StudioRepository} from '../modules/commerce/application/studio-ports.js';
import {StudioUseCases,StudioAccessDenied,StudioUnavailable} from '../modules/commerce/application/studio-use-cases.js';
import {InvalidStudioInput} from '../modules/commerce/domain/studio.js';

const offer={title:'Clase personal',priceCOP:50000,durationMinutes:60,mode:'ONLINE' as const};
function fixture(){
  const called:string[]=[];
  const membership:MembershipPort={
    hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>
      w==='academy'&&roles.includes(u==='owner'?'OWNER':u==='admin'?'ADMIN':'STUDENT'),
  };
  const repository:StudioRepository={
    publicStore:async()=>null,
    config:async()=>{called.push('config');return {
      id:'academy',name:'Academia',slug:'academia',description:null,
      contactUrl:null,publicEnabled:false,brandColor:'#ffffff',timezone:'America/Bogota',
    };},
    update:async()=>{called.push('update');return {
      id:'academy',name:'Academia',slug:'academia',description:null,
      contactUrl:null,publicEnabled:false,
    };},
    offerings:async()=>{called.push('offerings');return [];},
    create:async()=>{called.push('create');return {id:'offer',title:'Clase',priceCOP:50000,published:false};},
    setPublished:async()=>{called.push('publish');return {id:'offer',published:true};},
  };
  return {app:new StudioUseCases(repository,membership),called};
}
test('students or actors from another academy cannot administer studio',async()=>{
  const {app,called}=fixture();
  await assert.rejects(app.config('academy','student'),StudioAccessDenied);
  await assert.rejects(app.create('foreign','owner',offer),StudioAccessDenied);
  assert.deepEqual(called,[]);
});
test('invalid pricing and contact URLs are rejected before persistence',async()=>{
  const {app,called}=fixture();
  await assert.rejects(app.create('academy','owner',{...offer,priceCOP:-50}),InvalidStudioInput);
  await assert.rejects(app.update('academy','owner',{contactUrl:'javascript:alert(1)'}),InvalidStudioInput);
  await assert.rejects(app.setPublished('academy','owner','offer',{published:'true'}),InvalidStudioInput);
  assert.deepEqual(called,[]);
});
test('public studio requires a visible storefront; managers may administer drafts',async()=>{
  const {app,called}=fixture();
  await assert.rejects(app.publicStore('academia'),StudioUnavailable);
  await app.create('academy','admin',offer);
  await app.update('academy','owner',{publicEnabled:true});
  await app.setPublished('academy','owner','offer',{published:true});
  assert.deepEqual(called,['create','update','publish']);
});
