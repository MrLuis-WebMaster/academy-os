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


## AI (code integrated, provider not connected)

- AcademyOS uses an **outbound adapter** for OpenAI Responses API structured JSON outputs. Core learning logic never imports provider SDKs.
- Enable on the API only through `ACADEMY_AI_ENABLED=true`, `OPENAI_API_KEY` in a secret manager, and a supported `ACADEMY_AI_MODEL`. Default is **disabled**.
- Class Alive generates 2–4 teacher-reviewable multiple-choice questions as unpublished drafts; no automatic publication.
- Profe SOS reads only teacher-approved notes from the student's enrolled course, returns verified class references and suggests escalation to the teacher when evidence is insufficient.
- Consent is asked **on every generation/question**; do not use real student private data or data of minors until privacy policies and guardian consent are reviewed.
- There is one shared cap of **10 attempts per academy per UTC day**. It bounds request volume, not guaranteed USD cost; monitor actual usage separately.
- The API requests `store:false` and does not store student tutor conversation history. Review the provider's actual retention settings and contract separately.
- See [AI_PROVIDER_SETUP.md](AI_PROVIDER_SETUP.md).


## Google Calendar — autorización de cuenta (2026-11-23)

El flujo independiente de Better Auth ya está conectado al panel Gestión real. Se solicita únicamente `calendar.events.owned`, mediante OAuth code flow, PKCE S256, estado de un solo uso (10 minutos) vinculado al usuario y la academia, y credenciales cifradas AES-256-GCM con contexto de usuario/academia. La desconexión local elimina las credenciales y solicitudes pendientes, no revoca permisos globales en Google. La cuenta puede gestionar estos permisos desde su página de conexiones de Google. Usar un proyecto OAuth dedicado para no mezclar la revocación con el login.

Configurar solo en un entorno privado: `GOOGLE_CALENDAR_ENABLED=true`, `GOOGLE_INTEGRATIONS_CLIENT_ID`, `GOOGLE_INTEGRATIONS_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY` (32 bytes aleatorios en hexadecimal). Registrar la URL exacta `https://TU_DOMINIO/api/v1/integrations/google-calendar/callback` en el cliente OAuth web. Mantener la clave de cifrado estable y respaldada por separado. No activar antes de validar HTTPS, callback, scope, expiración y consentimiento. El flujo no crea eventos, no sincroniza cambios ni genera enlaces Meet todavía; faltan refresh, revocación remota controlada, recuperación y lifecycle de eventos. El proveedor sigue apagado por defecto.

Referencia técnica: https://developers.google.com/identity/protocols/oauth2/web-server
