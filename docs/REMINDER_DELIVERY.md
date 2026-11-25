# AcademyOS — recordatorios internos opt-in

## Comportamiento
Los alumnos pueden activar explícitamente avisos **dentro de AcademyOS** 24 horas antes o 1 hora antes de las clases reservadas. La configuración se guarda por usuario y academia. Por defecto ambas opciones están desactivadas. No envía correos, WhatsApp, SMS ni push.

La tarea de entrega evalúa las clases confirmadas próximas, sin datos de otros espacios. Comprueba nuevamente la reserva BOOKED, la matrícula activa, la membresía STUDENT y las preferencias opt-in. Los avisos se guardan dentro de una transacción protegida por el mismo lock que usa la reserva y el cambio de horario. El `eventKey` incluye clase, fecha/hora e intervalo 24h/1h, por lo que los reintentos no duplican notificaciones.

Las notificaciones se generan cuando el worker observa la ventana de 20 minutos posterior al momento de disparo. Si el sistema está detenido más de 20 minutos, ese aviso puede perderse y **no** se envían mensajes atrasados. Esto evita alertas confusas demasiado tarde. El worker revisa cada minuto mientras esté activo y el DB esté disponible. No puede sustituir un cron con garantías operativas, monitoreo y backups.

## Endpoints
- `GET /api/v1/workspaces/:workspaceId/notifications/reminder-preferences`: preferencias del estudiante autenticado.
- `PATCH /api/v1/workspaces/:workspaceId/notifications/reminder-preferences`: `{"remind24h":true,"remind1h":false}`.
- Los avisos se consultan en la bandeja de notificaciones existente.

## Activación del worker en un entorno controlado
No se inicia automáticamente con el servidor API, el repo o la suite de pruebas. Configurar `ACADEMY_IN_APP_REMINDERS_ENABLED=true` y la conexión de PostgreSQL como secretos; iniciar `pnpm --filter @academy-os/api worker:reminders` después de compilar el API. Para un único barrido controlado, añadir `--once`.

No se ha activado en un servidor real. Agregar el worker al sistema de despliegue como proceso supervisado solamente cuando existan monitoreo, alertas y políticas de reinicio.

## Integraciones futuras
Email, WhatsApp, push y sincronización Google/Zoom necesitan sus propias preferencias y consentimientos, outbox externo duradero, colas, reintentos/backoff y verificación de proveedor. No está implementado ni habilitado ningún envío externo.


## Hito 37 — avisos transaccionales por correo
- Migración zi_email_notice_delivery: preferencia opt-in por alumno/academia (apagada por defecto, fecha de consentimiento), cola de entrega con una fila por notificación, leases, intentos y resultado. La fuente durable son las notificaciones internas ya creadas por las transacciones de negocio; no se modifica su entrega in-app.
- API GET/PATCH /api/v1/workspaces/:workspaceId/notifications/email-preferences, sesión, rol STUDENT y email verificado; PATCH exige origen autorizado. El alumno puede retirar consentimiento incluso si el servicio global se desactiva. No se envían avisos anteriores al opt-in ni se permite elegir direcciones arbitrarias.
- Worker selecciona hasta 200 notificaciones nuevas elegibles por ciclo, procesa hasta 10 entregas, revalida consentimiento, membresía y correo verificado antes de enviar; los recordatorios requieren también clase futura confirmada, reserva vigente, matrícula, horario y preferencia 24h/1h actual. Los avisos de otros tipos son genéricos; no contienen títulos de clases ni nombres.
- Resend mediante puerto EmailProvider, HTTPS fijo, timeout de 10s, clave idempotente estable por notificación. La documentación del proveedor describe deduplicación de la misma solicitud durante 24h (https://resend.com/docs/dashboard/emails/idempotency-keys). Se limita la antigüedad del aviso a 20h y hasta seis intentos con backoff, leases recuperables y finalización CAS. No garantiza exactamente una entrega: cambios de payload, restauraciones, revocación mientras una solicitud está en vuelo y respuestas ambiguas requieren tratamiento operativo. SENT significa aceptado por proveedor, no entregado al buzón.
- Solo inscripciones, reservas, cambios/cancelaciones de clase y recordatorios internos. No se transmiten nombres, calificaciones, notas, contenido SOS, enlaces de reuniones, pagos ni datos de otros alumnos; mensaje genérico con enlace HTTPS a AcademyOS. El proveedor recibe el email verificado del destinatario. No es marketing. No habilitar menores hasta definir consentimiento y privacidad.
- Preferencias en Aula Digital con controles explícitos. ACADEMY_EMAIL_NOTICES_ENABLED=false por defecto. Para staging: dominio y remitente verificados en Resend, RESEND_API_KEY con permiso de envío (solo worker en Compose), ACADEMY_EMAIL_FROM, perfil email-notices, y perfil reminders si se necesitan recordatorios 24h/1h. Revisar logs agregados; no almacenar credenciales en repositorio. Preflight valida formato, no servicio real.
- Pruebas de dominio, transporte simulado, opt-in/revocación, idempotencia, reintentos, concurrencia y aislamiento en email-notices.test.ts y email-notices-postgres.test.ts. No se confirmó ejecución del CI ni envíos reales.
- Pendientes: panel operativo de entregas y rebotes/quejas, supresión, políticas de conservación, verificación real DNS/SPF/DKIM/DMARC, notificaciones de profesores, personalización segura, límites por cuenta, agrupación de avisos, push/WhatsApp, invitaciones por email y recordatorios de suscripción. Los registros se eliminan en cascada con notificaciones; no constituyen auditoría legal inmutable.
