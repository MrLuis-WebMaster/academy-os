import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkspaceInput, slugify } from './inputs.js';

const valid = { type: 'SOLO', name: 'Academia de Laura', timezone: 'America/Bogota', requestId: 'ac29714e-beb8-47b1-90d5-2748c0fc9c89' };
test('normalizes unicode brand names', () => assert.equal(slugify('Academia Ángela y Física'), 'academia-angela-y-fisica'));
test('requires owner-provisioning request id', () => assert.throws(() => parseWorkspaceInput({ ...valid, requestId: '' })));
test('rejects reserved slugs', () => assert.throws(() => parseWorkspaceInput({ ...valid, slug: 'admin' })));
test('rejects invalid timezones', () => assert.throws(() => parseWorkspaceInput({ ...valid, timezone: 'Some/Nowhere' })));
test('deduplicates initial subjects', () => assert.deepEqual(parseWorkspaceInput({ ...valid, subjects: ['Inglés','Inglés'] }).subjects, ['Inglés']));
