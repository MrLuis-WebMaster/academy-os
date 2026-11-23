import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {VenueRepository} from '../modules/scheduling/application/venue-ports.js';
import {VenueUseCases,VenueAccessDenied} from '../modules/scheduling/application/venue-use-cases.js';
import {InvalidVenueInput} from '../modules/scheduling/domain/venues.js';

function fixture(){
 const calls:string[]=[];
 const member:MembershipPort={
  hasAnyRole:async(w,user,roles:readonly WorkspaceRole[])=>
   w==='a'&&roles.includes(user==='owner'?'OWNER':user==='teacher'?'TEACHER':'STUDENT'),
 };
 const repo:VenueRepository={
  list:async()=>{calls.push('list');return [];},
  createCampus:async()=>{calls.push('campus');return {id:'c',name:'Centro',address:'Calle 1',active:true};},
  changeCampus:async()=>{calls.push('changeCampus');return {id:'c',name:'Centro',address:'Calle 1',active:true};},
  createRoom:async()=>{calls.push('room');return {id:'room',campusId:'c',name:'Aula 1',capacity:30,active:true};},
  changeRoom:async()=>{calls.push('changeRoom');return {id:'room',campusId:'c',name:'Aula 1',capacity:30,active:true};},
 };
 return {app:new VenueUseCases(repo,member),calls};
}
test('venue operations are restricted by workspace and manager roles',async()=>{
 const {app,calls}=fixture();
 await assert.rejects(app.createCampus('a','student',{name:'Centro',address:'Calle 1'}),VenueAccessDenied);
 await assert.rejects(app.createRoom('a','teacher','c',{name:'Aula 1',capacity:30}),VenueAccessDenied);
 await assert.rejects(app.list('b','owner'),VenueAccessDenied);
 assert.deepEqual(calls,[]);
 await app.list('a','teacher');
 await app.createCampus('a','owner',{name:'Centro',address:'Calle 1'});
 await app.createRoom('a','owner','c',{name:'Aula 1',capacity:30});
 assert.deepEqual(calls,['list','campus','room']);
});
test('invalid names, room sizes and identifiers are rejected before storage',async()=>{
 const {app,calls}=fixture();
 await assert.rejects(app.createCampus('a','owner',{name:'x',address:'Avenida 123'}),InvalidVenueInput);
 await assert.rejects(app.createRoom('a','owner','c',{name:'Aula',capacity:0}),InvalidVenueInput);
 await assert.rejects(app.changeRoom('a','owner','',{active:false}),InvalidVenueInput);
 assert.deepEqual(calls,[]);
});
