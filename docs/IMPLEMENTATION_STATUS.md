# Implementation status — November 22, 2026

## Milestone 1: authentication and tenant onboarding

- Implemented in code: Better Auth 1.7.27 (Google SSO), Prisma 7 storage model and sessions; NestJS global authenticated guard, public health/auth config endpoints; workspace provisioning transaction creates OWNER, optional subjects, request idempotency and tenant authorization; Vue three-step guided onboarding, optional demo screen and workspace switching.
- External configuration required: Google Cloud OAuth client/secret; BETTER_AUTH_SECRET; running PostgreSQL; versioned Prisma migrations already exist (0_init, 1_invitations, 2_resource_publication). Google identity only; Drive and Calendar scopes are **not** obtained at login.
- Authenticated dashboard after onboarding still displays **mock schedules, people and course cards**. They are not persistent and must not be confused with real data. **Operations** UI now connects to real workspace-scoped subject, course, teacher and manually linked session endpoints. The original prototype remains separate and uses mock data.
- Teacher/student/admin invitation links, invitation acceptance with email matching and token replay protection, course enrolment, student classroom scope and PostgreSQL migrations have been added; the live Google OAuth flow is still untested without external credentials.
- Dedicated-instance one-time bootstrap (separate from multi-tenant self-service sign-up) is still planned, not implemented.
- Implemented additionally: class cancellation with teacher/owner authorization, course-linked HTTPS materials with a publication gate, and a **manual Class Alive** teacher-notes draft/approval/student-publication workflow (AI-generation and interactive exercises not implemented). The CI applies versioned migrations to a temporary PostgreSQL 19 server and smoke-tests the API.

Not finished: class attendance/assignments, student payments, recording consent, Google Calendar/Meet/Zoom/Drive OAuth, AI-generated Class Alive content, interactive Class Alive exercises, Learning Passport UI/evidence, Profe SOS, Profe Studio commerce, branded subdomains, integration E2E/tenant security audit, production deployment.

## Next acceptance milestone

1. Real Google sign-in on a configured preview environment and DB migration; verify callback, cookie, session, logout.
2. Cross-workspace RBAC and provisioning tests against a live PostgreSQL service in CI.
3. Replace demo dashboard elements with workspace-scoped API resources.
4. Complete teacher/student life cycle, editing/rebooking and availability, notifications, payment handling, real class exercises and AI usage safeguards. Invitations, course enrolment, cancellation and a teacher-conflict-aware manual scheduling endpoint now exist.

## QA notes

Run `pnpm db:validate`, `pnpm db:generate`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Node.js 26 with pnpm 10.30.3. Running the auth API requires env secrets and a PostgreSQL database. Never commit real credentials or user/student records.
