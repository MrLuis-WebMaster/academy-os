#!/usr/bin/env node
/**
 * Offline validation of staging configuration. Never prints secret values.
 * Usage: node scripts/check-staging-config.mjs [path-to-env-file]
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseEnv(source) {
  const values = {};
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) throw new Error(`Invalid env syntax at line ${index + 1}`);
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (Object.hasOwn(values, match[1])) throw new Error(`Duplicate key ${match[1]}`);
    values[match[1]] = value;
  }
  return values;
}

export function validateStagingConfig(env) {
  const errors = [];
  const required = ['STAGING_DOMAIN', 'STAGING_DB_PASSWORD', 'STAGING_DATABASE_URL', 'BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  for (const key of required) {
    const value = env[key]?.trim();
    if (!value || /REPLACE_WITH|CHANGE_ME|YOUR_|example\.com|example\.invalid|placeholder/i.test(value)) {
      errors.push(`${key}: missing or example value`);
    }
  }
  const domain = env.STAGING_DOMAIN || '';
  if (!/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(domain) || /localhost|\.local$|\.invalid$|\.test$/.test(domain)) {
    errors.push('STAGING_DOMAIN: expected a real hostname without scheme or path');
  }
  if ((env.BETTER_AUTH_SECRET || '').length < 32 || /^(.)\1{31,}$/.test(env.BETTER_AUTH_SECRET || '')) {
    errors.push('BETTER_AUTH_SECRET: provide at least 32 unpredictable characters');
  }
  if ((env.STAGING_DB_PASSWORD || '').length < 16) {
    errors.push('STAGING_DB_PASSWORD: use at least 16 characters');
  }
  try {
    const url = new URL(env.STAGING_DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'postgres' ||
        url.username !== 'academy' || url.pathname !== '/academy_os') {
      errors.push('STAGING_DATABASE_URL: expected postgres service, academy user and academy_os database');
    }
    if (decodeURIComponent(url.password) !== env.STAGING_DB_PASSWORD) {
      errors.push('STAGING_DATABASE_URL: password differs from STAGING_DB_PASSWORD');
    }
  } catch {
    errors.push('STAGING_DATABASE_URL: invalid URL');
  }
  if (env.ACADEMY_AI_ENABLED === 'true' && !env.OPENAI_API_KEY?.trim()) {
    errors.push('OPENAI_API_KEY: required when academy AI is enabled');
  }
  if (env.ACADEMY_AI_ENABLED && !['true', 'false'].includes(env.ACADEMY_AI_ENABLED)) {
    errors.push('ACADEMY_AI_ENABLED: must be true or false');
  }
  if (env.GOOGLE_CALENDAR_ENABLED && !['true', 'false'].includes(env.GOOGLE_CALENDAR_ENABLED)) {
    errors.push('GOOGLE_CALENDAR_ENABLED: must be true or false');
  }
  if (env.GOOGLE_CALENDAR_ENABLED === 'true') {
    for (const key of ['GOOGLE_INTEGRATIONS_CLIENT_ID', 'GOOGLE_INTEGRATIONS_CLIENT_SECRET']) {
      if (!env[key]?.trim() || /REPLACE_WITH|CHANGE_ME|YOUR_|placeholder/i.test(env[key])) errors.push(key + ': required when Google Calendar is enabled');
    }
    if (!/^[a-fA-F0-9]{64}$/.test(env.INTEGRATION_ENCRYPTION_KEY || '') || /^(.)\1{63}$/.test(env.INTEGRATION_ENCRYPTION_KEY || '')) {
      errors.push('INTEGRATION_ENCRYPTION_KEY: provide 32 random bytes in hexadecimal');
    }
  }
  if (env.GOOGLE_CALENDAR_SYNC_WORKER_ENABLED && !['true', 'false'].includes(env.GOOGLE_CALENDAR_SYNC_WORKER_ENABLED)) {
    errors.push('GOOGLE_CALENDAR_SYNC_WORKER_ENABLED: must be true or false');
  }
  if (env.GOOGLE_CALENDAR_SYNC_WORKER_ENABLED === 'true' && env.GOOGLE_CALENDAR_ENABLED !== 'true') {
    errors.push('GOOGLE_CALENDAR_SYNC_WORKER_ENABLED: requires GOOGLE_CALENDAR_ENABLED=true');
  }
  if (env.ACADEMY_PRIVATE_FILES_ENABLED && !['true', 'false'].includes(env.ACADEMY_PRIVATE_FILES_ENABLED)) {
    errors.push('ACADEMY_PRIVATE_FILES_ENABLED: must be true or false');
  }
  if (env.ACADEMY_PACKAGE_ORDERS_ENABLED && !['true', 'false'].includes(env.ACADEMY_PACKAGE_ORDERS_ENABLED)) {
    errors.push('ACADEMY_PACKAGE_ORDERS_ENABLED: must be true or false');
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] || '.env.staging';
  try {
    const errors = validateStagingConfig(parseEnv(readFileSync(path, 'utf8')));
    if (errors.length) {
      console.error('Staging preflight failed:\n' + errors.map(error => '- ' + error).join('\n'));
      process.exitCode = 1;
    } else {
      console.info('Staging configuration passed offline structural checks. DNS, OAuth, TLS and secrets strength still require real validation.');
    }
  } catch (error) {
    console.error('Staging preflight failed:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  }
}
