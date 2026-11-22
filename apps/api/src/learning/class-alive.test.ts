import test from 'node:test';
import assert from 'node:assert/strict';
import { noteInput } from './class-alive.controller.js';

test('notes require meaningful teacher reflection',()=>{
  assert.equal(noteInput.safeParse({notes:'Muy corto'}).success,false);
  assert.equal(noteInput.safeParse({notes:'Hoy practicamos funciones y repasamos conceptos esenciales de JavaScript.'}).success,true);
});
test('notes reject huge payloads',()=>{
  assert.equal(noteInput.safeParse({notes:'x'.repeat(12001)}).success,false);
});
