import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingInput } from './input.js';
const input = { title:'JavaScript fundamentals', teacherProfileId:'teacher-123', mode:'ONLINE', startsAt:'2026-12-01T12:00:00-05:00',endsAt:'2026-12-01T13:00:00-05:00',meetingUrl:'https://meet.google.com/abc-defg-hij' };
test('accepts manually linked online session',()=>assert.equal(bookingInput.safeParse(input).success,true));
test('rejects online without an actual URL',()=>assert.equal(bookingInput.safeParse({...input,meetingUrl:undefined}).success,false));
test('rejects invalid in-person location',()=>assert.equal(bookingInput.safeParse({...input,mode:'ONSITE',meetingUrl:undefined}).success,false));
test('rejects overlapping time order',()=>assert.equal(bookingInput.safeParse({...input,endsAt:input.startsAt}).success,false));
test('accepts a hybrid session',()=>assert.equal(bookingInput.safeParse({...input,mode:'HYBRID',location:'Sede Centro, Salón 2'}).success,true));
