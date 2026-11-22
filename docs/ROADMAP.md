# AcademyOS roadmap — actualizado 2026-11-22

Cada marca `[x]` indica funcionalidad codificada en el repo, **no un lanzamiento público aprobado**. `[~]` indica incompleto.

## Etapa 0 — Foundation
- [x] Repositorio independiente y monorepo pnpm (Vue 3, NestJS, Tailwind 4, Prisma 7).
- [x] Paquete `@academy-os/ui`: 14 primitivas, estilos semánticos, tema claro/oscuro/sistema, galería en desarrollo.
- [x] Normalización compartida de slug y cliente HTTP único usado por varias pantallas.
- [x] DDD/hexagonal en Academics: materias y cursos; pruebas con puertos fake.
- [x] Control de fronteras arquitectónicas en CI (`pnpm arch:check`).
- [ ] Migrar los demás contextos (tenancy, scheduling, learning, commerce) sin cambiar el contrato HTTP existente.
- [x] Migraciones versionadas y validación con PostgreSQL 19 en CI.
- [x] PWA estática con fallback offline sin caché de información privada.
- [~] Pruebas de aislamiento en PostgreSQL y sobrecupo concurrente (verificar CI más reciente).
- [ ] Fijar lockfile reproducible, staging HTTPS y backups automáticos.

## Etapa 1 — MVP operativo
- [x] Better Auth + Google, sesiones y onboarding self-service OWNER implementados en código.
- [x] Invitaciones de docente/alumno/admin, roles por espacio.
- [x] Materias, cursos, temas jerárquicos, docentes asignados, inscripciones.
- [x] Clases ONLINE/ONSITE/HYBRID con enlaces manuales; reservas, cancelación, cupos y registro de asistencia.
- [x] Aula Digital con materiales por curso, controles de publicación y sesiones.
- [x] Registro manual de cobros; no captura pagos externos.
- [x] Profe Studio con catálogo público, precio COP y contacto externo, desactivado por defecto.
- [ ] E2E de Google OAuth con credenciales reales y despliegue staging.
- [ ] Gestión completa de disponibilidad recurrente, reprogramaciones, sedes/aulas, notificaciones y calendario de grupos.
- [ ] Checkout con pasarela, conciliación, reembolsos y facturación.
- [ ] E2E de flujos, privacidad/menores y auditoría multi-tenant integral.

## Etapa 2 — aprendizaje e integraciones
- [x] Clase Viva: observaciones y publicación de notas bajo supervisión humana.
- [x] Prácticas redactadas por profesores, corrección automática y hasta tres intentos.
- [x] Pasaporte inicial: media de resultados reales de prácticas por curso (no inferir dominio integral).
- [ ] IA para sugerir ejercicios y resúmenes (opt-in, revisión docente, cuotas).
- [ ] Profe SOS basado en materiales autorizados y con derivación al profesor.
- [ ] OAuth Meet/Calendar, Zoom y Google Drive con lifecycle, revocación y tests.
- [ ] Almacenamiento propio y revisión de seguridad de recursos.
- [ ] Notificaciones y recordatorios automáticos, consentimiento explícito.

## Etapa 3 — academia y white-label avanzados
- [ ] Roles de acudientes verificados, privacidad para menores y reportes familiares.
- [ ] Sedes/aulas, docentes sustitutos, reservas recurrentes, recursos compartidos.
- [ ] Dominios personalizados, branding completo, multimoneda y planes comerciales.
- [ ] OneDrive, Dropbox, Outlook/Teams y más conectores.
- [ ] Instancias dedicadas con activación segura del propietario.
- [ ] Analítica avanzada, soporte, facturación, backups, observabilidad y lanzamiento.

## Condiciones de lanzamiento
Cumplir [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Nunca considerar CI verde como sustituto de pruebas de Google OAuth, pagos, seguridad y protección de alumnos.
