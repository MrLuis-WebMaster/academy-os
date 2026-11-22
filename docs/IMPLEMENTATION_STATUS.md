# AcademyOS — Implementation status (2026-11-22)

## Entregas codificadas en `main`
- Login Better Auth + Google: flujo implementado, necesita credenciales OAuth, base real y validación E2E; registro de propietario mediante onboarding de tres pasos.
- Persistencia Prisma/PostgreSQL con migraciones `0_init` a `12_weekly_series`, guards de sesiones y permisos tenant.
- Profesores, alumnos, cursos, materias, asignación de profesores, temas y matrículas.
- Clases virtuales/presenciales/híbridas, enlaces manuales, detección básica de choques, cancelaciones, reserva de cupos transaccional y asistencia.
- Aula Digital protegida para inscripciones y publicaciones de materiales HTTPS.
- Clase Viva de anotaciones aprobadas, cuestionarios manuales con corrección e historial de intentos; Pasaporte de resultados basados en evidencia.
- Profe Studio básico (página pública solo tras habilitarla) y catálogo de servicios.
- Finanzas manuales con recibos y anulaciones; no es una pasarela real.
- PWA con precaché de activos públicos y pantalla offline; nada privado se guarda en caché.
- CI: Prisma validate/generate/migrate + tests + build + smoke checks; prueba nueva de aislamiento y concurrencia añadida (última ejecución pendiente de confirmación).

## Hito 2: arquitectura reusable y sistema visual

- Añadido workspace `packages/ui` (`@academy-os/ui`) con 14 componentes y tokens de diseño, incluyendo modo claro, oscuro y automático; selector accesible y galería local en Vite.
- Pantallas existentes migradas parcialmente a primitives (`AuthGate`, `OperationsPanel`, `StudentClassroom`, `StudioEditor`, `PublicStorefront`). El refactor visual total está pendiente.
- Cliente HTTP común `apps/web/src/shared/api-client.ts` aplicado a siete pantallas para no duplicar serialización y manejo de errores.
- DDD/hexagonal implementado en Academics para subjects/courses con valor de dominio, aplicación independiente, puertos, adaptadores Prisma y controladores NestJS; el resto del backend sigue en proceso de migración.
- GitHub CI ahora ejecuta un verificador de límites arquitectónicos y tests de resolución de preferencias de tema.

## Últimas implementaciones (misma fecha)

- Academics/Enrollment separado por DDD/hexagonal: alta y baja de matrícula, y liberación de cupos futuros.
- Scheduling/Booking y Reschedule separados en dominio, aplicación y adaptadores; historial de cambios de clases y avisos en el portal del alumno.
- El formulario de clases ya acepta cupos 1–500 para clases grupales.
- Nuevo módulo Learning basado en puertos: generación opcional de ejercicios mediante OpenAI Responses API (Structured Outputs), siempre en borrador editable y con publicación docente.
- Tutor Profe SOS sin historial de conversaciones, solo con notas aprobadas por el profesor y acceso por matrícula, validación de citas y derivación si faltan pruebas.
- Proveedor IA desactivado por defecto, aprobación expresa del docente/alumno y límite de 10 intentos por academia y día.
- Migraciones PostgreSQL `7_session_reschedule`, `8_ai_generation` y `9_weekly_availability`.
- Disponibilidad semanal por docente/academia, comprobación por zona horaria al crear o reprogramar sesiones, interfaz de administración de franjas.
- `pnpm-lock.yaml` generado en GitHub Actions y versionado; instalación congelada para CI.
- Cliente HTTP compartido ahora completa encabezados de JSON omitidos por pantallas antiguas.

## Hito 3: notificaciones y calendario (2026-11-22)

- Contexto Notifications hexagonal: dominio puro, casos de uso, puerto de almacenamiento, adaptador Prisma y controller. Mensajes se limitan a la academia y al usuario autenticado; `readAt` no se comparte entre alumnos.
- Migración `10_in_app_notifications` y publicación transaccional con eventos de cancelación o reprogramación. Solo alumnos con reserva activa reciben el aviso, sin datos privados de otras personas.
- Confirmación in-app de inscripción y reserva (incluida una nueva reserva tras cancelación) con publicador personal genérico, transacciones e idempotencia.
- Bandeja visual reutilizable con iconos Lucide, contador de no leídos, lectura individual y general, reinicio de estado al cambiar de academia.
- Exportación `.ics` privada: filtro por OWNER/ADMIN (todo el espacio), TEACHER (sus clases), STUDENT (sus reservas). Incluye UID estable, actualización de secuencia, campos escapados y control de caché.
- Pruebas de aislamiento real PostgreSQL e idempotencia de los avisos; pruebas unitarias de permisos y serialización ICS.
- **No está implementado el envío de email, push, WhatsApp ni la sincronización OAuth.** La importación de calendario es manual.

## Hito 4: calendario semanal y ausencias

- DDD hexagonal para `scheduling/time-off`: crear/listar/eliminar ausencias por docente; permisos de OWNER/ADMIN o docente asignado, límites y auditoría básica.
- El sistema rechaza una ausencia que pisa sesiones confirmadas; también rechaza crear o reprogramar sobre una ausencia.
- DDD hexagonal para series de clases: de 2 a 16 semanas, mismo horario de reloj en la zona horaria de la academia aun con cambios DST. No transforma una hora local inexistente en otra hora.
- Migraciones PostgreSQL `11_teacher_time_off` y `12_weekly_series`; `ClassSeries` conserva las relaciones de cada sesión, sin impedir su cancelación individual.
- Creación de la serie en una **única transacción** con el mismo bloqueo de profesor utilizado por sesiones sueltas y ausencias; conflictos de horario, clase existente o vacaciones revierten todos los cambios.
- Gestión real incluye selector de repetición y pantalla de vacaciones. Las series aparecen identificadas en el listado de clases y sus ocurrencias se exportan a ICS.
- No existe aún edición/eliminación masiva de una serie, generación automática de festivos según país ni invitaciones recurrentes de videollamada.

## Límites no resueltos
- OAuth Google en entorno real, test del callback, cookies, sesiones y logout end-to-end.
- Meet/Zoom/Drive, correo transaccional, sync calendario, app almacenamiento no conectado.
- Clase Viva IA y Profe SOS implementados en código pero **sin credenciales externas ni pruebas de un proveedor real**; faltan resúmenes IA, fuentes Drive y gestión robusta de datos de menores.
- Checkout, cobros reales, facturación y reembolsos no implementados.
- Dedicado bootstrap OWNER, acudientes, recuperación de cuenta, consentimientos para menores y grabaciones.
- Auditoría/observabilidad/backup, publicación por dominios y pruebas de seguridad profundas.
- El dashboard original sigue siendo una demo; la pantalla **Gestión real** contiene los flujos persistentes.
- El código no está desplegado como servicio para clientes.

## Estado de integraciones
Credenciales privadas necesarias en el entorno, nunca en GitHub. Ver `GOOGLE_LOGIN_SETUP.md`, `INTEGRATIONS.md` y `RELEASE_CHECKLIST.md`. La visibilidad actual del repositorio es pública.

## QA local
```bash
pnpm install --frozen-lockfile
docker compose up -d
pnpm db:validate
pnpm db:generate
pnpm --filter @academy-os/api exec prisma migrate deploy
pnpm typecheck && pnpm test && pnpm build
```
