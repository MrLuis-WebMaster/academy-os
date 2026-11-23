# AcademyOS roadmap — actualizado 2026-11-23

Cada marca `[x]` indica funcionalidad codificada en el repo, **no un lanzamiento público aprobado**. `[~]` indica incompleto.

## Etapa 0 — Foundation
- [x] Repositorio independiente y monorepo pnpm (Vue 3, NestJS, Tailwind 4, Prisma 7).
- [x] Paquete `@academy-os/ui`: 14 primitivas, estilos semánticos, tema claro/oscuro/sistema, galería en desarrollo.
- [x] Normalización compartida de slug y cliente HTTP único usado por varias pantallas.
- [x] DDD/hexagonal en Academics, Scheduling, Attendance, Finance, Classroom (materiales), Learning, Notifications y Calendar, con pruebas de puertos falsos y algunas pruebas reales de PostgreSQL.
- [x] Control de fronteras arquitectónicas en CI (`pnpm arch:check`).
- [~] Tenancy, Commerce, publicación de actividades y Curriculum migrados a DDD/hexagonal; faltan algunas proyecciones de lectura heredadas y auditoría integral.
- [x] Migraciones versionadas y validación con PostgreSQL 19 en CI.
- [x] PWA estática con fallback offline sin caché de información privada.
- [~] Pruebas de aislamiento de academias, clases concurrentes y sobrecupo con PostgreSQL; falta cobertura integral de rutas y E2E.
- [x] Versionar `pnpm-lock.yaml` y utilizar instalación congelada en CI.
- [ ] Plantilla staging HTTPS con Docker, Caddy, PostgreSQL y backup/restore manual en Git; faltan despliegue real, copias programadas y restauración probada.

## Etapa 1 — MVP operativo
- [x] Better Auth + Google, sesiones y onboarding self-service OWNER implementados en código.
- [x] Invitaciones de docente/alumno/admin, roles por espacio.
- [x] Materias, cursos, temas jerárquicos, docentes asignados, inscripciones.
- [x] Clases ONLINE/ONSITE/HYBRID con enlaces manuales; reservas, cancelación, cupos y registro de asistencia.
- [x] Aula Digital con materiales por curso, creación en borrador y publicación/retiro explícitos, visibles solo a inscritos.
- [x] Registro manual de cobros; no captura pagos externos.
- [x] Profe Studio con catálogo público, precio COP y contacto externo, desactivado por defecto.
- [ ] E2E de Google OAuth con credenciales reales y despliegue staging.
- [~] Reprogramación auditada y reservas existentes, franjas semanales, **ausencias y festivos manuales**, series semanales de 2–16 clases y notificaciones in-app transaccionales. Faltan festivos automáticos por país, sedes/aulas, edición masiva de series, email/WhatsApp/push y calendario avanzado.
- [ ] Checkout con pasarela, conciliación, reembolsos y facturación.
- [ ] E2E de flujos, privacidad/menores y auditoría multi-tenant integral.

## Etapa 2 — aprendizaje e integraciones
- [x] Clase Viva: observaciones y publicación de notas bajo supervisión humana.
- [x] Prácticas redactadas por profesores, corrección automática y hasta tres intentos.
- [x] Pasaporte inicial: media de resultados reales de prácticas por curso (no inferir dominio integral).
- [~] Generación de **prácticas** con OpenAI Responses API, opt-in y revisión/edición docente, diez usos diarios compartidos por academia; pendiente validar con API key real. Resúmenes generados automáticamente aún no implementados.
- [~] Profe SOS con acceso limitado a **notas publicadas** de cursos inscritos, referencias a las clases y derivación al profesor; pendiente probar API externa y añadir otros materiales autorizados.
- [x] Exportación privada de calendario `.ics` filtrada por rol (importación manual, sin OAuth).
- [ ] OAuth Meet/Calendar, Zoom y Google Drive con lifecycle, revocación y tests.
- [ ] Almacenamiento propio y revisión de seguridad de recursos.
- [x] Bandeja in-app con leído/no leído y notificaciones de matrículas, reservas y cambios de clases, con entrega transaccional e idempotente, sin envíos externos.
- [ ] Recordatorios programados y avisos por correo/push/WhatsApp con consentimiento explícito.

## Etapa 3 — academia y white-label avanzados
- [ ] Roles de acudientes verificados, privacidad para menores y reportes familiares.
- [~] Series semanales de clases, todas o ninguna, con validación DST y conflictos; cancelación masiva de futuras sesiones con avisos in-app, sin alterar clases anteriores. Falta edición masiva y reservas recurrentes de estudiantes.
- [ ] Sedes/aulas, docentes sustitutos y recursos compartidos.
- [ ] Dominios personalizados, branding completo, multimoneda y planes comerciales.
- [ ] OneDrive, Dropbox, Outlook/Teams y más conectores.
- [ ] Instancias dedicadas con activación segura del propietario.
- [ ] Analítica avanzada, soporte, facturación, backups, observabilidad y lanzamiento.

## Condiciones de lanzamiento
Cumplir [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Nunca considerar CI verde como sustituto de pruebas de Google OAuth, pagos, seguridad y protección de alumnos.

## Hito posterior: asistencia DDD
- [x] Registro y consulta de asistencia en módulo hexagonal separado, conservando rutas y permisos.
- [x] Bloqueo transaccional de cambios de asistencia frente a cancelaciones, revalidación de academia/rol/docente en la escritura.
- [ ] Validar junto al resto del sistema mediante CI y pruebas end-to-end antes de declararlo listo para usuarios reales.

## Hito: Classroom materiales por capas
- [x] Materiales HTTPS migrados a contexto hexagonal y conservación de GET/POST existentes.
- [x] Endpoint de publicación/retiro con validación de permisos, academia y curso dentro de transacción.
- [x] Control visual de publicación en Gestión real; evita respuestas tardías de otro workspace en el listado.
- [ ] Gestión de archivos privados, permisos reales de enlaces externos y OAuth Drive/Dropbox.

## Hito: sesiones individuales DDD y permisos (2026-11-23)
- [x] GET/POST de clases y PATCH de cancelación migrados a `modules/scheduling` sin cambiar contratos HTTP.
- [x] La vista de clases para TEACHER solo incluye sesiones asignadas a ese docente; administradores pueden ver la academia completa.
- [x] Creación con verificación de academia, rol, profesor, curso, disponibilidad, ausencias y solapamiento dentro de transacción con lock de docente.
- [x] Cancelación con locks de reserva y docente, avisos internos transaccionales y reintentos idempotentes.
- [x] Pruebas unitarias y prueba de integración con PostgreSQL de autorización, aislamiento y concurrencia codificadas.
- [ ] Verificar el CI más reciente y ejecutar pruebas reales de UI/credenciales OAuth y seguridad ampliada antes de habilitar un piloto.

## Hitos adicionales — 23 de noviembre de 2026
- [x] Clase Viva con publicación humana transaccional, notas inmutables una vez publicadas y aislamiento por docente/academia.
- [x] Prácticas y Pasaporte por capas hexagonales, 3 intentos máximos protegidos bajo concurrencia, sin filtrar claves al estudiante.
- [x] Invitaciones seguras con tokens de un solo uso, email vinculado, límites diarios y tests PostgreSQL.
- [x] Provisioning OWNER idempotente incluso con dos envíos concurrentes y materias deduplicadas por slug.
- [x] Profe Studio por capas, ofertas privadas por defecto, control de publicación y filtro de cursos de otras academias.
- [x] Temarios y asignaciones docentes por capas; solamente docentes asignados consultan/editar contenidos del curso.
- [x] Plantilla Compose/Caddy HTTPS, backup/restore manual y validación sintáctica en CI.
- [ ] Probar servidor real, OAuth Google, proveedores externos, pago, seguridad y restauración antes de un piloto.
