# AcademyOS — lanzamiento seguro

## Credenciales y despliegue
- [ ] Crear staging HTTPS/DNS, base de datos PostgreSQL aislada y backups con prueba de restauración.
- [ ] Configurar en secret manager `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, `BETTER_AUTH_URL`, `WEB_ORIGIN`.
- [ ] Google Cloud: origins/redirect URIs correctas, cuenta de prueba y políticas OAuth.
- [ ] Migraciones versionadas revisadas y `prisma migrate deploy` aplicado sin drift.
- [ ] Proteger secretos, rate limiting, protección CSRF/CORS, audit logs y métricas.
- [ ] Evaluación de accesibilidad mobile, recuperación de cuentas, eliminación de datos y exportación.
- [ ] Pruebas visuales automatizadas en claro/oscuro/sistema, contraste WCAG AA y navegación por teclado.
- [ ] Migrar componentes de negocio restantes a los primitives reutilizables de `@academy-os/ui`.
- [ ] Mantener dashboard demo separado y no poner datos ficticios ante clientes.
- [ ] Pruebas de regresión de series semanales, DST, feriados, huecos de agenda y cambios de hora por zona real.
- [ ] Definir edición/cancelación masiva de series y notificaciones para alumnos ya inscritos.

## Seguridad funcional
- [ ] E2E real de Google OAuth, primera academia, alternar espacios, invitaciones, revocación.
- [ ] Suite negativa IDOR/cross tenant en **todas** las rutas + conflictos concurrentes y sobrecupo.
- [ ] Evaluar relaciones cross-tenant en DB además de validar cada controlador.
- [ ] Consentimiento y control de representantes de menores, materiales privados, grabaciones y retención.
- [ ] Pruebas de permisos OWNER/ADMIN/TEACHER/STUDENT/GUARDIAN.

## Servicios externos (no conectados)
- [ ] Google Calendar/Meet OAuth con permisos separados del login.
- [ ] Zoom OAuth, host/plan restrictions, lifecycle y cancelación.
- [ ] Google Drive Picker, access revocation y protección de documentos.
- [x] Bandeja in-app y avisos transaccionales de cancelación/reprogramación, aislados por usuario/academia.
- [x] Exportación manual ICS con roles, sin OAuth ni enlaces públicos.
- [ ] Envío real de confirmaciones y recordatorios por email.
- [x] Código de generador de borradores de IA, proveedor adaptable, consentimiento por acción, revisión docente y tope de diez solicitudes/día/academia.
- [ ] Verificar OpenAI Responses API con una clave y facturación reales, políticas de datos, monitoreo de costes y logs redactados.
- [ ] Revisar cumplimiento para menores y políticas de privacidad antes de habilitar IA en producción.
- [ ] Pasarela de pagos: webhooks firmados, idempotencia, reembolsos, conciliación e impuestos.
- [ ] Condiciones comerciales y privacidad revisadas para las regiones de lanzamiento.

## Go/no-go
No anunciar el sistema como terminado ni aceptar datos sensibles de clientes sin pasar toda la lista anterior. CI verde y módulos base codificados son pasos necesarios, no suficientes.
