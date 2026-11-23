import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidenceBasedProfile} from '../modules/learning/domain/learner-profile.js';

test('student profile only suggests next steps supported by verified scores and goals',()=>{
 const skills=[
  {topicId:'math',mastery:55,evidenceCount:2,topic:{title:'Fracciones',courseId:'c',course:{title:'Matemáticas'}}},
  {topicId:'grammar',mastery:90,evidenceCount:1,topic:{title:'Past simple',courseId:'d',course:{title:'Inglés'}}},
 ];
 const goals=[
  {id:'g1',courseId:'c',topicId:'math',title:'Comparar fracciones',targetMastery:80,targetAt:null,status:'ACTIVE' as const,completedAt:null,course:{title:'Matemáticas'}},
  {id:'g2',courseId:'d',topicId:'grammar',title:'Conversar usando pasado',targetMastery:80,targetAt:null,status:'ACHIEVED' as const,completedAt:new Date(),course:{title:'Inglés'}},
  {id:'g3',courseId:'c',topicId:'new',title:'Resolver decimales',targetMastery:70,targetAt:null,status:'ACTIVE' as const,completedAt:null,course:{title:'Matemáticas'}},
 ];
 const profile=buildEvidenceBasedProfile(skills,goals);
 assert.equal(profile.verifiedCompetencies,2);
 assert.equal(profile.humanEvidenceCount,3);
 assert.equal(profile.activeGoals,2);
 assert.equal(profile.achievedGoals,1);
 assert.deepEqual(profile.nextActions.map(action=>action.reason),['BELOW_TARGET','NO_EVIDENCE']);
 assert.equal(profile.nextActions[0]?.verifiedMastery,55);
 assert.equal(profile.nextActions[1]?.verifiedMastery,null);
 assert.equal(profile.milestones[0]?.title,'Conversar usando pasado');
 assert.ok(!JSON.stringify(profile).includes('diagnóstico'));
});
test('no invented learning weaknesses if teacher has not recorded evidence or goals',()=>{
 const profile=buildEvidenceBasedProfile([],[]);
 assert.equal(profile.nextActions.length,0);
 assert.equal(profile.milestones.length,0);
 assert.equal(profile.verifiedCompetencies,0);
 assert.equal(profile.humanEvidenceCount,0);
});
