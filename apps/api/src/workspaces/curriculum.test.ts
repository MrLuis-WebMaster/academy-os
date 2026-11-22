import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentInput,topicInput} from './curriculum.controller.js';
test('topics can nest under a parent but require names',()=>{
 assert.equal(topicInput.safeParse({title:'Álgebra'}).success,true);
 assert.equal(topicInput.safeParse({title:' '}).success,false);
 assert.equal(topicInput.safeParse({title:'Funciones',parentId:'topic-one',order:2}).success,true);
});
test('teacher assignments have strict IDs',()=>{
 assert.equal(assignmentInput.safeParse({teacherId:'teacher-1'}).success,true);
 assert.equal(assignmentInput.safeParse({teacherId:''}).success,false);
});
