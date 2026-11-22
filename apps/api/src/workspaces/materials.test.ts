import test from 'node:test';
import assert from 'node:assert/strict';
import { externalResourceInput } from './materials.controller.js';

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
});
