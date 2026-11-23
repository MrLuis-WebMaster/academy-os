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
