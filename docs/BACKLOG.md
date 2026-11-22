# AcademyOS backlog

These issues are intended for the **new `academy-os` repository**, not an existing project.

| Priority | Epic | Acceptance criteria |
| --- | --- | --- |
| P0 | Identity and multi-tenancy | Sign-up, session security, workspace SOLO/ACADEMY, multiple memberships, RBAC, tenant isolation E2E |
| P0 | Staff, students and curriculum | Teachers with multiple subjects, multiple courses per subject, optional topics, enrollment and permissions |
| P0 | Scheduling and booking | Online, onsite, hybrid; capacity, timezone, teacher conflicts, rescheduling, cancellation, reminders |
| P0 | Digital Classroom | Class details, join link/location, materials, assignments, attendance, communications |
| P0 | Test/quality infrastructure | Pin lockfile, schema validation, CI, migration safety, logging, environment management |
| P1 | Provider architecture | Secure connections, OAuth state/PKCE, token vault reference, adapter interfaces, webhook validation |
| P1 | Google Meet and Calendar | Create/reschedule/cancel calendar events with confirmed conference links; reconnection |
| P1 | Zoom | OAuth connect and meeting lifecycle, account and plan restrictions, link visibility |
| P1 | Google Drive | Picker, attach authorized resources, no unapproved AI processing, permission checks |
| P1 | Class Alive | Teacher reflection and optional audio, draft exercises, teacher approval, student attempts |
| P1 | Learning Passport | Goals, teacher-reviewed evidence, skill progression, per-course achievements |
| P1 | Profe SOS | Curriculum-scoped tutors, safeguards, escalating to a human, quota/cost reporting |
| P2 | Profe Studio commerce | Branded public page, booking funnel, packages, payments, membership and refunds |
| P2 | Academy advanced | Multi-branch rooms, substitute teachers, teacher scheduling, family portal |
| P2 | More integrations | OneDrive, Dropbox, Outlook/Teams, additional providers |

## Definition of done

- User stories and acceptance tests exist.
- Frontend is accessible, mobile responsive and resilient to empty/loading/error states.
- Backend validates data and resource membership, with positive and negative tests.
- CI green, dependency lockfile committed, migrations reviewed.
- No exposed secrets, personal student data, unapproved recordings or unreviewed AI content.
