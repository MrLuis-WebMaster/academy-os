# AcademyOS architecture — RFC 001

## Core domain

Identity → Workspace (SOLO or ACADEMY) → Members → Teachers + Students → Subjects → Courses/Services → Topics → Sessions → Learning activities.

One user may have several memberships and teach multiple subjects across different workspaces; data must never be shared by default. A teacher can have their own branded account and separately participate in institutional academies. Subjects and optional course/topic hierarchy are deliberately not fixed to formal schooling: one-off coaching sessions are supported.

## Modules

| Module | Purpose | Status |
| --- | --- | --- |
| Core | auth, workspace, roles, branding | schema only |
| Catalog | subjects, multiple teachers per course, students | schema + demo UI |
| Scheduling | virtual, onsite, hybrid, location/meeting provider | validation + demo UI |
| Aula Digital | materials, attendance, assignments per session | planned |
| Class Alive | teacher notes or approved audio → draft → review → practice | concept UI |
| Learning Passport | goals, attempts, evidence-based progress | schema + demo UI |
| Profe SOS | AI tutor per subject; handoff to teacher | concept UI |
| Profe Studio | courses/services/booking storefront, pricing | brand preview |
| Integrations | Google/Zoom/Drive adapters with OAuth | planning UI |

## Tenant model

Membership with role OWNER / ADMIN / TEACHER / STUDENT / GUARDIAN. All server queries and mutations in the production implementation must be scoped by authenticated workspace membership and resource owner. A plain `workspaceId` request field must never be treated as authority. The Prisma schema currently defines relations; same-workspace constraints and authorization guards still need implementing.

## Main flows

1. Onboard → select professor or academy → brand → subjects → availability → publish.
2. Book → capacity/conflict check → timezone normalized to UTC → meeting link/physical location → notifications.
3. Teach → classroom session → attendance + teacher notes → draft Class Alive content → approve → personalized practice → learning evidence.
4. Studio → public offerings → payment → enrollment → booked sessions; purchases must be idempotent.

## UI conventions

- Tailwind CSS 4 tokens through CSS `@theme`; no custom `tailwind.config.js` required.
- Accessible buttons, keyboard interaction and responsive layouts.
- Use CSS variables for white-label theme; consistent design components.
- No unapproved AI content ever published to students.

## Backend direction

NestJS feature modules + Prisma client 7 and PostgreSQL 19 after validation. Apply auth/RBAC tenant guard at controller/service layer, add DB-level invariants and transaction safety for reservations. Integrations should use adapter interfaces (Meet, Zoom, storage), provider webhooks validated for authenticity and deduplicated jobs for calendar updates.
