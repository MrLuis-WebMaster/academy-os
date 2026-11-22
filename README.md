# AcademyOS

**Your academy. Your way.** A white-label learning operations SaaS designed for independent teachers and multi-teacher academies, including those teaching multiple subjects.

> **Development build — NOT production software.** Better Auth/Google and workspace onboarding are implemented in source, and teacher-owned spaces can persist subjects, courses and manually linked classes after PostgreSQL setup. Live Google sign-in still requires OAuth credentials and database migration. The original dashboard remains a **separate demo** with fictional data; payments, AI and external meeting/storage connectors are not implemented.

## Stack (stable releases chosen November 2026)

- **Web:** Vue 3.5, TypeScript 6 (required for vue-tsc compatibility), Tailwind CSS 4.3 with `@tailwindcss/vite`, Vite 8, Pinia 4, TanStack Vue Query.
- **API:** NestJS 12, TypeScript 7, Zod 4.
- **Database:** PostgreSQL 19 + Prisma ORM 7.10 (schema + migration configuration only; runtime persistence not connected).
- **Runtime:** Node.js 26 LTS, pnpm workspaces.
- **Testing:** `node:test` via `tsx`; GitHub Actions CI template.

## Getting started

```bash
corepack enable
pnpm install
cp .env.example apps/api/.env
docker compose up -d
pnpm db:validate
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Web: http://localhost:5173 · API: http://localhost:3001/api/v1/health

Google sign-in also requires `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `BETTER_AUTH_URL`; follow [Google OAuth setup](docs/GOOGLE_LOGIN_SETUP.md).

**Do not run a migration against production yet.** Create/review a baseline migration in development first. Tenant consistency and privacy/security tests are still incomplete.

## Implemented vertical slices

- Self-hosted Better Auth 1.7.27 with Google login, session guard and logout (requires valid credentials and live PostgreSQL).
- First-login three-step onboarding creates `Workspace` + `OWNER` + initial teacher profile and optional subjects transactionally.
- Workspace-scoped subject and course creation/listing; manual online, onsite and hybrid class scheduling with basic teacher-overlap prevention.
- A separate **Operations** screen shows real data; its predecessor dashboard remains explicitly labeled as a mock-only preview.
- One-use invitation links (7 days, SHA-256 token only in DB) add teachers, students or approved workspace admins after Google account verification.
- Course enrolments are saved in PostgreSQL; enrolled students receive an Aula Digital with course details, approved materials and class sessions.

## Features demonstrated

- Dashboard and workspace-type switch between teacher and academy.
- Multiple subjects per educator; teacher / student / course preview.
- Sessions of type virtual, onsite and hybrid with local scheduling form.
- Class Alive (Clase Viva), Learning Passport (Pasaporte), Profe SOS and Profe Studio concept screens.
- Google Meet, Zoom, Google Calendar, Google Drive, OneDrive, Dropbox: planned integrations displayed as NOT CONNECTED.
- White-label brand color and name preview.
- Responsive sidebar and functional local navigation.

## Source map

```text
academy-os/
  apps/
    web/      Vue + Tailwind 4 dashboard demo
    api/      NestJS + session validation + Prisma v7 schema
  docs/       architecture, product flows, rollout and security
  .github/    CI and dependency updates
```

## GitHub repository

The canonical home is [MrLuis-WebMaster/academy-os](https://github.com/MrLuis-WebMaster/academy-os), branch `main`. GitHub connection can push code to the existing repository. Follow the repository's permission and protection settings.

**Visibility:** the repository was public when this starter was imported. If this project should be private, change visibility in GitHub Settings > General > Danger Zone.

## TypeScript compatibility

The web workspace pins TypeScript 6.0.3 and vue-tsc 3.3.13 because vue-tsc 3.3.x cannot run with TypeScript 7's removed `typescript/lib/tsc` export. The NestJS API separately uses TypeScript 7.0.2. Upgrade only after upstream compatibility is verified and CI passes.

## Authentication and initial setup proposal

For the first production-capable iteration, use self-hosted Better Auth with Google sign-in and a short, skippable setup wizard that creates the first workspace OWNER. For dedicated branded deployments require a one-time setup invitation instead of trusting the first visitor. Details and acceptance criteria: [docs/AUTH_AND_ONBOARDING.md](docs/AUTH_AND_ONBOARDING.md). **This flow is specified but NOT implemented yet.**

## Limits and next steps

Read [product roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md) and [integration plan](docs/INTEGRATIONS.md). GitHub Actions has successfully installed dependencies, typechecked, tested, and built the foundation on `main` (see Actions history). Authentication, persistence and OAuth integration remain outstanding.
