import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '../lib/prisma.js';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const origin = process.env.WEB_ORIGIN || 'http://localhost:5173';
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32 || secret.startsWith('REPLACE_')) {
  throw new Error('BETTER_AUTH_SECRET must be a secure random string (at least 32 characters)');
}

export const googleConfigured = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
  secret,
  baseURL: process.env.BETTER_AUTH_URL || origin,
  basePath: '/api/auth',
  trustedOrigins: [origin],
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: false },
  socialProviders: googleConfigured
    ? { google: { clientId: googleClientId!, clientSecret: googleClientSecret! } }
    : {},
  advanced: { defaultCookieAttributes: { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true } },
});
