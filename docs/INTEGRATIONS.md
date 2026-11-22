# Integrations: design, not connected

## Video

- Google Meet: connect Google OAuth, create a Calendar event with conference data, store external event ID and confirmed meeting link. Handle updates, cancellation, declined auth and revoked tokens.
- Zoom: OAuth account integration, create/update/cancel meetings, enforce host/plan constraints. Don't promise recordings without explicit provider capability.
- Manual link: a safe fallback; validate URL, sanitize display and control participant access.

## Storage

- Google Drive: Google Picker and explicit user file selection. Store file ID, minimal metadata, permission context; never duplicate content by default. Don't pass documents to an AI provider without explicit authorization.
- OneDrive / Dropbox: adapter interfaces and connect buttons reserved for subsequent phases.
- Upload: future own S3-compatible storage with expiring signed URLs, quotas, anti-malware policies.

## Calendar & locations

- Google Calendar event sync, Outlook Calendar later; external IDs, idempotency and retry queues.
- In-person: address, room, instructor travel buffers, capacity and attendance.
- Hybrid: both online and physical instructions, seat-level joining rights.

## Security

OAuth state+PKCE where appropriate, least-privilege scopes, backend token vault, encryption at rest, signed webhooks, audits and revocation support. Institutional connections must not expose private files from the personal workspace. Consent requirements for recordings, AI processing and minor students are separate from OAuth consent.
