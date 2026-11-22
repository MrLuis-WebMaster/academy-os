import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSession } from './sessions.js';

const base = {
  title: 'Algebra - Lesson 1', subjectId: 'math', teacherId: 'teacher-1',
  mode: 'ONLINE', provider: 'MEET',
  startsAt: '2026-12-01T14:00:00-05:00', endsAt: '2026-12-01T15:00:00-05:00', capacity: 10,
};

test('accepts virtual classes with a provider', () => {
  assert.equal(validateSession(base).valid, true);
});
test('requires a location for presencial sessions', () => {
  assert.equal(validateSession({ ...base, mode: 'ONSITE', provider: null }).valid, false);
});
test('accepts hybrid with location and provider', () => {
  assert.equal(validateSession({ ...base, mode: 'HYBRID', location: 'Sede Laureles, Aula 2' }).valid, true);
});
test('rejects end before start', () => {
  assert.equal(validateSession({ ...base, endsAt: '2026-12-01T13:00:00-05:00' }).valid, false);
});
test('requires URL for custom meetings', () => {
  assert.equal(validateSession({ ...base, provider: 'CUSTOM' }).valid, false);
});
test('rejects invalid capacity', () => {
  assert.equal(validateSession({ ...base, capacity: 0 }).valid, false);
});
