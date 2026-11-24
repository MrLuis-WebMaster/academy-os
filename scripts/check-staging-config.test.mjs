import assert from 'node:assert/strict';
import test from 'node:test';
import {parseEnv, validateStagingConfig} from './check-staging-config.mjs';

const valid = {
  STAGING_DOMAIN: 'academy.staging.real-domain.org',
  STAGING_DB_PASSWORD: 'example-for-test-only-strong-123',
  STAGING_DATABASE_URL: 'postgresql://academy:example-for-test-only-strong-123@postgres:5432/academy_os?schema=public',
  BETTER_AUTH_SECRET: 'random-like-test-only-secret-1234567890',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  ACADEMY_AI_ENABLED: 'false',
};
test('validates structurally complete staging config', () => {
  assert.deepEqual(validateStagingConfig(valid), []);
});
test('rejects sample config and mismatched database password', () => {
  const bad = {...valid, STAGING_DOMAIN: 'academy.example.invalid', STAGING_DB_PASSWORD: 'other-password-12345'};
  const errors = validateStagingConfig(bad);
  assert.ok(errors.some(e => e.includes('STAGING_DOMAIN')));
  assert.ok(errors.some(e => e.includes('password differs')));
});
test('AI requires a server-side API key when enabled', () => {
  assert.ok(validateStagingConfig({...valid, ACADEMY_AI_ENABLED: 'true'}).some(e => e.startsWith('OPENAI_API_KEY')));
});
test('env reader rejects duplicate keys and supports comments and quotes', () => {
  assert.deepEqual(parseEnv('# comment\nPORT="3001"\n'), {PORT:'3001'});
  assert.throws(() => parseEnv('PORT=3001\nPORT=3002'), /Duplicate key/);
});
