import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReinforcementInsights} from '../modules/learning/domain/reinforcement-insights.js';

test('group reinforcement counts unique students below real teacher-set targets',()=>{
 const course={
  courseId:'c',topics:[{id:'t1',title:'Past simple',order:1}],
  students:[
   {id:'a',name:'A',skills:[{topicId:'t1',mastery:40,evidenceCount:2}],
    goals:[{topicId:'t1',targetMastery:80,status:'ACTIVE' as const},
           {topicId:'t1',targetMastery:70,status:'ACTIVE' as const}]},
   {id:'b',name:'B',skills:[{topicId:'t1',mastery:60,evidenceCount:1}],
    goals:[{topicId:'t1',targetMastery:80,status:'ACTIVE' as const}]},
   {id:'c',name:'C',skills:[{topicId:'t1',mastery:95,evidenceCount:1}],
    goals:[{topicId:'t1',targetMastery:80,status:'ACTIVE' as const}]},
  ],
 };
 const result=buildReinforcementInsights(course);
 assert.equal(result.insights.length,1);
 assert.equal(result.insights[0]?.belowTargetCount,2);
 assert.equal(result.insights[0]?.awaitingEvidenceCount,0);
 assert.equal(result.insights[0]?.action,'PREPARE_REINFORCEMENT');
});
test('missing evidence is not mislabeled as a difficulty',()=>{
 const course={courseId:'c',topics:[{id:'t',title:'Reading',order:0}],students:[
  {id:'a',name:'A',skills:[],goals:[{topicId:'t',targetMastery:80,status:'ACTIVE' as const}]},
  {id:'b',name:'B',skills:[],goals:[{topicId:'t',targetMastery:80,status:'ACTIVE' as const}]},
 ]};
 const result=buildReinforcementInsights(course);
 assert.equal(result.insights[0]?.belowTargetCount,0);
 assert.equal(result.insights[0]?.awaitingEvidenceCount,2);
 assert.equal(result.insights[0]?.action,'COLLECT_EVIDENCE');
});
test('no teacher-set target creates no reinforcement alerts',()=>{
 const course={courseId:'c',topics:[{id:'t',title:'Reading',order:0}],students:[
  {id:'a',name:'A',skills:[{topicId:'t',mastery:20,evidenceCount:1}],goals:[]},
  {id:'b',name:'B',skills:[{topicId:'t',mastery:30,evidenceCount:1}],goals:[]},
 ]};
 assert.deepEqual(buildReinforcementInsights(course).insights,[]);
});
