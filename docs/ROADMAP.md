# Roadmap / epics

## Phase 0 — independent foundation (in this archive)
- [x] Brand and independent repository structure
- [x] Vue dashboard prototype built on Tailwind CSS 4
- [x] NestJS API health + capabilities + session validation
- [x] Multi-tenant domain schema, Prisma v7 config, Docker Compose for PostgreSQL 19
- [x] CI pipeline template, unit tests for scheduling validation
- [x] Publish to independent `MrLuis-WebMaster/academy-os` repository on `main` (currently public, not private)
- [x] Install dependencies and verify typecheck/tests/build in GitHub Actions (green run confirmed)
- [ ] Commit reproducible pnpm lockfile and deploy preview

## Phase 1 — sellable MVP
- [ ] **FIRST PRIORITY:** Better Auth self-hosted + Google sign-in; sessions; secure tenant bootstrap; guided first OWNER setup; workspace isolation and RBAC (details in [AUTH_AND_ONBOARDING.md](AUTH_AND_ONBOARDING.md))
- [ ] Teacher/student CRUD; subjects, courses, topics; multiple teachers per course
- [ ] Availability, booking collision checks, instructor/location constraints, cancellation
- [ ] Online/onsite/hybrid sessions with manual video links and location
- [ ] Digital Classroom: files, assignments, attendance, messages
- [ ] Branded profile/storefront, plan packages, payments, basic reporting
- [ ] Accessibility, privacy and E2E tests

## Phase 2 — differentiation and external connections
- [ ] Google Calendar / Meet OAuth
- [ ] Zoom OAuth + meetings
- [ ] Drive Picker and resource authorization
- [ ] Class Alive: teacher reflection -> content draft -> approval -> student practice
- [ ] Passport: evidence-based progress, mastery recommendations
- [ ] Profe SOS: configurable tutor assistants per subject
- [ ] AI usage quotas, provider monitoring and cost controls

## Phase 3 — academy scale
- [ ] Billing, subscriptions, taxes, multi-branch / room management
- [ ] Advanced Profe Studio, digital downloads, memberships
- [ ] Parent/guardian portal with strict permissions
- [ ] OneDrive, Dropbox, Outlook/Teams integrations
- [ ] Analytics, multi-workspace operations, custom domains
