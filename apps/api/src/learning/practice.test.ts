import test from 'node:test';
import assert from 'node:assert/strict';
import {newPracticeSchema,attemptSchema,gradePractice,publicQuestions} from './practice.js';

const questions=[
  {prompt:'¿Cuánto es 2 + 3?',options:['4','5','6','7'],correctIndex:1,explanation:'2 + 3 = 5'},
  {prompt:'¿Cuánto es 2 × 4?',options:['8','4','6','2'],correctIndex:0},
];

test('four answer options and valid answer index are required',()=>{
  const input={sessionId:'session-1',title:'Matemáticas básicas',questions};
  assert.equal(newPracticeSchema.safeParse(input).success,true);
  assert.equal(newPracticeSchema.safeParse({...input,questions:[{...questions[0],correctIndex:9}]}).success,false);
  assert.equal(newPracticeSchema.safeParse({...input,questions:[]}).success,false);
});
test('student question list never exposes the key',()=>{
  const publicItems=publicQuestions(questions);
  assert.equal(JSON.stringify(publicItems).includes('correctIndex'),false);
  assert.equal(JSON.stringify(publicItems).includes('explanation'),false);
});
test('scoring is reproducible',()=>{
  const result=gradePractice(questions,[1,3]);
  assert.equal(result.score,50);
  assert.equal(result.correct,1);
  assert.equal(result.feedback[1].correctIndex,0);
  assert.throws(()=>gradePractice(questions,[1]));
});
test('student answers must be valid option indexes',()=>{
  assert.equal(attemptSchema.safeParse({answers:[-1]}).success,false);
  assert.equal(attemptSchema.safeParse({answers:[3.5]}).success,false);
  assert.equal(attemptSchema.safeParse({answers:[0,1]}).success,true);
});
