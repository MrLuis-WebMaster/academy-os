# AcademyOS — seguridad y privacidad (desarrollo activo)

Este proyecto **sí** contiene autenticación Better Auth, guard de sesión, autorización por membresía y persistencia PostgreSQL/Prisma. El panel de demo utiliza datos ficticios por separado. **La presencia de estas medidas en el código no equivale a una auditoría ni a un lanzamiento seguro.**

## Requisitos de protección

- Autenticar todas las rutas privadas y autorizar siempre por academia, usuario y rol **en el backend**, no por visibilidad de controles del frontend.
- Verificar aislamiento multi-tenant e IDOR, incluyendo IDs de cursos, alumnos, reservas, comprobantes, notificaciones y documentos. Repetir validación de pertenencia dentro de transacciones donde exista una escritura sensible.
- Registrar pagos solo como **comprobantes manuales de dinero recibido**. No confundirlos con checkout, pasarela, factura ni conciliación bancaria. OWNER puede anular comprobantes con motivo; OWNER/ADMIN pueden registrar y consultar.
- Guardar secretos OAuth solo en variables seguras del entorno. Nunca guardar llaves, datos reales de alumnos, tokens ni grabaciones en GitHub.
- Solicitar consentimiento y definir retención y eliminación para menores, grabaciones, transcripciones y procesamiento por IA.
- Publicar cualquier contenido generado por IA solo tras revisión explícita del profesor.
- Impedir la exposición pública de enlaces privados de materiales y videollamadas.
- Añadir limitación de frecuencia, registros auditables, monitorización, pruebas E2E de OAuth, copias de seguridad y restauración antes de invitar clientes reales.
- Revisar [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) y las migraciones de cada release antes de desplegar.

## Módulo de finanzas

El contexto `modules/finance` sigue DDD/hexagonal: reglas y validación de comprobantes en dominio, autorización por casos de uso, puertos de membresía y datos, Prisma en infraestructura, rutas NestJS en presentación. Las rutas siguen bajo `/api/v1/workspaces/:workspaceId/finance`. Incluye pruebas de aislamiento y permisos con dobles y PostgreSQL real. Esto no sustituye auditoría financiera, pruebas E2E ni controles de producción.

## Sesiones, profesores y notificaciones

Las rutas de creación, listado y cancelación de sesiones están aisladas por academia y rol. En el listado, un TEACHER solo ve las clases vinculadas a su perfil. La creación valida referencias del mismo workspace y evita solapamientos bajo un lock transaccional de docente. La cancelación valida el estado y al actor tras los locks de reservas/docente, publica avisos internos dentro de la transacción y no admite modificar clases `COMPLETED`. Las pruebas PostgreSQL cubren múltiples academias, acceso de docentes diferentes y solicitudes simultáneas, pero no equivalen a una auditoría integral de todas las rutas.

## Avances de seguridad — 2026-11-23
- Autorización de publicación humana, intentos de alumnos con máximo de tres solicitudes, protección de claves de respuestas y validación de matrícula.
- Invitaciones como hashes, de uso único, vinculadas al correo y con cuotas serializadas; solo OWNER puede invitar ADMIN.
- Provisioning idempotente y cursos/asignaciones limitados a su academia.
- Profe Studio privado por defecto y filtrado por workspace.
- Persisten pendientes E2E real, consentimiento de menores, OAuth, auditoría completa, backups reales y rate limiting en gateway.

## Controles de agenda incorporados (2026-11-23)

- Las reservas recurrentes se confirman completamente o revierten; el mismo lock por sesión protege el aforo durante solicitudes concurrentes.
- La edición de series futuras serializa reservas y cambios docentes, conserva histórico, valida aforo y publica avisos internos transaccionales.
- Las aulas están asociadas a una academia y los locks físicos impiden asignar la misma sala simultáneamente a dos docentes.
- La política de feriados se activa expresamente y no cancela clases ya existentes.
- Continúan pendientes E2E, protección de menores, revisión de privacidad y servicios externos.

## Evidencia académica y recordatorios (2026-11-23)

- La evidencia de competencias es humana, con puntuación entera, fecha y revisor identificados, operaciones idempotentes y agregación bajo lock por estudiante/tema.
- Las metas tienen eventos de auditoría de estado; no se completan automáticamente por IA ni por resultados de ejercicios.
- Solo el docente asignado o un administrador puede consultar registros de un curso y publicar evidencias. Los alumnos acceden únicamente a su progreso en los cursos donde mantienen matrícula.
- Los recordatorios son voluntarios, nunca mensajes externos. Se revalida matrícula, reserva BOOKED y consentimiento opt-in antes de crear un aviso, bajo lock de reserva.
- Faltan políticas de protección infantil, eliminación/retención de datos y auditoría de seguridad integral.

## Acceso de acudientes (2026-11-23)

- Tener rol GUARDIAN **no** habilita automáticamente acceso a ningún alumno: el manager debe crear y aprobar un vínculo específico.
- La aprobación exige una declaración expresa y una nota de verificación manual sin cargar documentos sensibles. La app no verifica identidad legal ni parentesco por medios propios.
- GUARDIAN solo consulta cursos, promedios de competencias humanos y estados de metas de alumnos enlazados y con matrícula activa. No recibe notas de evaluación, conversaciones, materiales, enlaces de clase ni datos financieros.
- La revocación es inmediata en el control de lectura, puede iniciarla el manager, guardian o alumno, se audita y exige nueva aprobación para restaurar el acceso.
- Uso con menores pendiente de verificación externa de parentesco, consentimiento exigible, privacidad, retención y revisión legal.
