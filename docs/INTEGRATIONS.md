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

Configurar solo en un entorno privado: `GOOGLE_CALENDAR_ENABLED=true`, `GOOGLE_INTEGRATIONS_CLIENT_ID`, `GOOGLE_INTEGRATIONS_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY` (32 bytes aleatorios en hexadecimal). Registrar la URL exacta `https://TU_DOMINIO/api/v1/integrations/google-calendar/callback` en el cliente OAuth web. Mantener la clave de cifrado estable y respaldada por separado. No activar antes de validar HTTPS, callback, scope, expiración y consentimiento. El flujo permite exportación manual de una clase, con actualización, eliminación de eventos y generación opcional de Meet; incluye renovación de tokens. Quedan pendientes la sincronización automática, revocación remota controlada, recuperación y validación real. El proveedor sigue apagado por defecto.

Referencia técnica: https://developers.google.com/identity/protocols/oauth2/web-server

### Exportación individual de clases y Meet
- Desde Gestión real → Google Calendar, seleccionar una clase confirmada o cancelada y autorizar explícitamente la exportación. OWNER/ADMIN acceden a las clases de su academia; TEACHER, solo a las propias.
- Se transmite el título tal cual (revisar que no tenga datos personales), fechas y zona horaria. No se incluyen asistentes, notas ni identificadores de alumnos. El evento se configura como privado y sin envío explícito de invitaciones.
- Se usa un ID estable por conexión y clase y se comprueba un marcador de propiedad antes de actualizar o retirar. Reintentar tras un conflicto; no se sobreescriben eventos ajenos. La renovación de token usa comparación de la credencial anterior para no pisar reconexiones.
- En clases virtuales/híbridas puede solicitarse Meet. La generación es asíncrona del lado de Google; repetir la exportación para obtener el enlace si está pendiente. El enlace no se incorpora a la clase de AcademyOS ni se publica a alumnos.
- Cambios de horario y cancelaciones requieren volver a exportar manualmente. No hay reconciliación automática, cola, recuperación de eventos borrados remotamente ni garantías ante cambios simultáneos externos. Desconectar no borra eventos creados ni revoca el permiso en Google. Reconectar después de desconectar puede generar otro identificador.
- Pruebas simuladas en `apps/api/src/integration/google-calendar-oauth.test.ts` y `google-calendar-events.test.ts`; falta comprobar CI y probar proveedor, scopes y callback reales.


## Hito 26 — Publicar Meet y sincronizar cambios
- La exportación individual admite `publishMeet:true` exclusivamente si también se solicita Meet. La API obtiene la URL del proveedor y valida el host; revalida permisos, conexión, título, fecha, estado y enlace anterior antes de publicar. El Aula Digital entrega links únicamente con reserva activa y matrícula. AcademyOS no controla permisos de admisión dentro de Meet ni puede revocar una URL previamente copiada.
- La opción `autoSync:true` guarda consentimiento por conexión/clase después de una exportación exitosa. Actualizaciones de título, horario, zona y estado generan una nueva revisión en la misma transacción de PostgreSQL. El worker solo modifica eventos existentes identificados por AcademyOS; no importa cambios remotos ni crea reuniones automáticamente. Cancelar la clase solicita retirar su evento. Los fallos reintentan hasta cinco veces o requieren revisión, y una edición posterior vuelve a poner la revisión en cola.
- Activar únicamente en un entorno privado después de configurar OAuth: `GOOGLE_CALENDAR_ENABLED=true`, `GOOGLE_CALENDAR_SYNC_WORKER_ENABLED=true`; levantar con `docker compose --env-file .env.staging -f compose.staging.yaml --profile calendar-sync up -d calendar-sync`. El perfil no expone puertos. Alternativamente, tras compilar, `pnpm --filter @academy-os/api worker:calendar-sync`.
- El usuario puede detener por clase sin borrar el evento remoto. Una petición ya iniciada podría terminar. Desconectar elimina las suscripciones por cascada; reconectar requiere volver a autorizar la sincronización. Si Google elimina un evento, se requiere revisión manual. No hay sincronización bidireccional ni garantías de entrega exactamente una vez; falta verificar concurrencia con ediciones externas y credenciales reales.
- Pruebas añadidas: `google-meet-publication.test.ts`, `google-meet-postgres.test.ts`, `calendar-sync-queue.test.ts`. No se ha confirmado CI verde para este hito.
