import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTheme} from './theme.js';

test('system follows light or dark device preference',()=>{
 assert.equal(resolveTheme('system',false),'light');
 assert.equal(resolveTheme('system',true),'dark');
});
test('explicit preference overrides operating system',()=>{
 assert.equal(resolveTheme('light',true),'light');
 assert.equal(resolveTheme('dark',false),'dark');
});
