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
- [~] **FIRST PRIORITY:** Better Auth self-hosted + Google sign-in, session guard, multi-tenant 3-step OWNER setup implemented; live Google OAuth, dedicated bootstrap, full tenant audit and E2E verification pending (details in [AUTH_AND_ONBOARDING.md](AUTH_AND_ONBOARDING.md))
- [~] Subject/course creation and listing implemented; teacher/student invitations and course enrolments implemented; topic CRUD and multi-teacher assignment pending
- [~] Teacher overlap checks and authorized cancellation implemented; availability rules, physical resources, rescheduling and notifications pending
- [~] Online/onsite/hybrid manual URL/location sessions saved to DB; rebooking, reminders and external calendar sync pending
- [~] Student Digital Classroom with course enrolment, sessions and published HTTPS materials implemented; uploads/assignments/attendance/messages pending
- [ ] Branded profile/storefront, plan packages, payments, basic reporting
- [ ] Accessibility, privacy and E2E tests

## Phase 2 — differentiation and external connections
- [ ] Google Calendar / Meet OAuth
- [ ] Zoom OAuth + meetings
- [ ] Drive Picker and resource authorization
- [~] Class Alive teacher notes -> draft -> manual approval -> student-visible recap implemented; AI activity generation and student practice pending
- [ ] Passport: evidence-based progress, mastery recommendations
- [ ] Profe SOS: configurable tutor assistants per subject
- [ ] AI usage quotas, provider monitoring and cost controls

## Phase 3 — academy scale
- [ ] Billing, subscriptions, taxes, multi-branch / room management
- [ ] Advanced Profe Studio, digital downloads, memberships
- [ ] Parent/guardian portal with strict permissions
- [ ] OneDrive, Dropbox, Outlook/Teams integrations
- [ ] Analytics, multi-workspace operations, custom domains
