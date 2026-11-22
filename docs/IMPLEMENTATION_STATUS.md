# Implementation status — November 22, 2026

## Milestone 1: authentication and tenant onboarding

- Implemented in code: Better Auth 1.7.27 (Google SSO), Prisma 7 storage model and sessions; NestJS global authenticated guard, public health/auth config endpoints; workspace provisioning transaction creates OWNER, optional subjects, request idempotency and tenant authorization; Vue three-step guided onboarding, optional demo screen and workspace switching.
- External configuration required: Google Cloud OAuth client/secret; BETTER_AUTH_SECRET; running PostgreSQL; first Prisma migration. Google identity only; Drive and Calendar scopes are **not** obtained at login.
- Authenticated dashboard after onboarding still displays **mock schedules, people and course cards**. They are not persistent and must not be confused with real data. **Operations** UI now connects to real workspace-scoped subject, course, teacher and manually linked session endpoints. The original prototype remains separate and uses mock data.
- Dedicated-instance one-time bootstrap (separate from multi-tenant self-service sign-up) is still planned, not implemented.
- Not finished: session cancellations, attendance, payments, recording consent, OAuth integrations, Class Alive, Learning Passport, Profe SOS, Profe Studio commerce, branded subdomains, production tenancy integrity and migration testing.

## Next acceptance milestone

1. Real Google sign-in on a configured preview environment and DB migration; verify callback, cookie, session, logout.
2. Cross-workspace RBAC and provisioning tests against a live PostgreSQL service in CI.
3. Replace demo dashboard elements with workspace-scoped API resources.
4. Extend real teacher/student invitations, editable courses, cancellations, booking policies and payments. Basic course/subject CRUD and a teacher-conflict-aware manual session endpoint have been added.

## QA notes

Run `pnpm db:validate`, `pnpm db:generate`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Node.js 26 with pnpm 10.30.3. Running the auth API requires env secrets and a PostgreSQL database. Never commit real credentials or user/student records.
