# AcademyOS — lanzamiento seguro

## Controles codificados y probados en CI
- [x] Onboarding OWNER idempotente e invitaciones con control de permisos y cuotas PostgreSQL.
- [x] Clase Viva y prácticas con acceso por matrícula, publicación humana y límites concurrentes de intentos.
- [x] Profe Studio y curriculum limitados por academia.
- [x] Plantilla staging, scripts manuales de respaldo/restauración y validación de configuración Compose.
- [ ] Staging con dominio real, Google OAuth, restauración verificada y auditoría E2E.

## Credenciales y despliegue
- [ ] Crear staging HTTPS/DNS, base de datos PostgreSQL aislada y backups con prueba de restauración.
- [ ] Configurar en secret manager `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, `BETTER_AUTH_URL`, `WEB_ORIGIN`.
- [ ] Google Cloud: origins/redirect URIs correctas, cuenta de prueba y políticas OAuth.
- [ ] Migraciones versionadas revisadas y `prisma migrate deploy` aplicado sin drift.
- [ ] Proteger secretos, rate limiting, protección CSRF/CORS, audit logs y métricas.
- [ ] Evaluación de accesibilidad mobile, recuperación de cuentas, eliminación de datos y exportación.
- [ ] Pruebas visuales automatizadas en claro/oscuro/sistema, contraste WCAG AA y navegación por teclado.
- [~] Más paneles de negocio usan primitives de `@academy-os/ui`; faltan refinar componentes legados, visualizaciones de datos y controles responsive.
- [ ] Mantener dashboard demo separado y no poner datos ficticios ante clientes.
- [~] Pruebas automáticas de series, DST, festivos de Colombia, cupos y aulas; faltan QA humano y zonas internacionales.
- [x] Cancelación masiva de sesiones semanales futuras, transaccional y con avisos internos por reserva.
- [x] Edición masiva de series y reservas recurrentes de estudiantes codificadas con pruebas PostgreSQL.
- [ ] Comunicación externa para clases recurrentes y pruebas con proveedores reales.

## Seguridad funcional
- [ ] E2E real de Google OAuth, primera academia, alternar espacios, invitaciones, revocación.
- [ ] Suite negativa IDOR/cross tenant en **todas** las rutas + conflictos concurrentes y sobrecupo.
- [ ] Evaluar relaciones cross-tenant en DB además de validar cada controlador.
- [~] Vínculos GUARDIAN con aprobación y revocación codificados, pero faltan consentimiento legal, verificación de identidad, materiales/retención y políticas para menores.
- [~] Pruebas automatizadas de roles OWNER/ADMIN/TEACHER/STUDENT/GUARDIAN, aprobaciones y revocaciones familiares; faltan E2E real y validación de identidad/representación.

## Servicios externos (no conectados)
- [ ] Google Calendar/Meet OAuth con permisos separados del login.
- [ ] Zoom OAuth, host/plan restrictions, lifecycle y cancelación.
- [ ] Google Drive Picker, access revocation y protección de documentos.
- [x] Bandeja in-app y avisos transaccionales de cancelación/reprogramación, aislados por usuario/academia.
- [x] Exportación manual ICS con roles, sin OAuth ni enlaces públicos.
- [x] Lógica y worker de recordatorios internos opt-in con pruebas de PostgreSQL; permanece apagado por defecto.
- [ ] Ejecutar worker bajo supervisión, comprobar recuperación de interrupciones y activar métricas.
- [ ] Envío real de confirmaciones y recordatorios por email/push/WhatsApp.
- [x] Código de generador de borradores de IA, proveedor adaptable, consentimiento por acción, revisión docente y tope de diez solicitudes/día/academia.
- [ ] Verificar OpenAI Responses API con una clave y facturación reales, políticas de datos, monitoreo de costes y logs redactados.
- [ ] Revisar cumplimiento para menores y políticas de privacidad antes de habilitar IA en producción.
- [ ] Pasarela de pagos: webhooks firmados, idempotencia, reembolsos, conciliación e impuestos.
- [ ] Condiciones comerciales y privacidad revisadas para las regiones de lanzamiento.

## Go/no-go
No anunciar el sistema como terminado ni aceptar datos sensibles de clientes sin pasar toda la lista anterior. CI verde y módulos base codificados son pasos necesarios, no suficientes.

## Identidad y métricas
- [x] Color de marca validado como HEX y logo HTTPS opcional; catálogo público privado hasta activación explícita.
- [x] Indicadores por rol OWNER/ADMIN y academia; sin exponer datos personales en respuestas agregadas.
- [ ] Verificar propiedad y privacidad de imágenes externas, DNS, accesibilidad y restricciones de dominios personalizados.
- [ ] Auditoría formal de métricas financieras, reconciliación e impuestos antes de llamarlas ingresos.

## Metodología y PWA de academia
- [x] Diferenciación de profesor independiente y pequeña academia con permisos por docente/curso.
- [x] Metodología aislada por docente y SOS opt-in, avisos de dudas docentes sin proveedores externos.
- [x] Perfil educativo determinista sobre evidencias docentes, sin inferencias psicológicas.
- [x] Metadatos PWA y ruta pública única por academia publicada.
- [ ] Revisar seguridad del prompt del profesor, ataques de inyección de notas, retención de dudas, política IA y pruebas con proveedor real.
- [ ] Probar instalación PWA en Android/iOS, generar iconos PNG y verificar propiedades de caché y URLs.
- [ ] Dominios personalizados, DNS, certificados, cuota SaaS y planes comerciales; no marcar como configurados.

## Paquetes, repaso y material pedagógico
- [x] Asignaciones manuales de créditos idempotentes y consumos concurrentes bloqueados en PostgreSQL.
- [x] Devolución transaccional de créditos al cancelar reservas y clases, también series futuras.
- [x] Flashcards y microlecciones privadas mientras son borradores; publicación humana y aislamiento de matrículas.
- [ ] Confirmación financiera real de pagos, revocaciones auditadas, políticas de reembolso monetario y consumos obligatorios en clases de pago.
- [ ] Validación E2E de todos los caminos de consumo y devolución, incluidos feriados, reprogramaciones y cambios de membresía.
- [ ] Evaluación de tarjetas IA con contenido docente real y consentimiento, seguridad de audio y recursos multimedia antes de piloto.

## Reserva de cursos restringidos
- [x] Cursos existentes gratuitos por defecto y política configurable solo por propietario/administrador.
- [x] Verificación de crédito en backend bajo locks de reserva, curso y asignación; reservas y consumos en la misma transacción.
- [x] Series de clases de pago completamente atómicas, incluidas reprogramaciones y cancelaciones existentes.
- [x] Activación prohibida si existen reservas futuras no pagadas con créditos.
- [ ] Pago real, conciliación, anulaciones financieras, acceso pagado a materiales/cursos y pruebas E2E con comprador y administrador reales.
