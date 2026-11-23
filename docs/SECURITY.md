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
