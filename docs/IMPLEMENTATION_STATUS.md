# AcademyOS — Implementation status (2026-11-23)

## Entregas codificadas en `main`
- Login Better Auth + Google: flujo implementado, necesita credenciales OAuth, base real y validación E2E; registro de propietario mediante onboarding de tres pasos.
- Persistencia Prisma/PostgreSQL con migraciones versionadas hasta `14_campuses_rooms`, guards de sesiones y permisos tenant.
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
- Hay cancelación masiva de próximas sesiones de una serie, con notificación privada por reserva y preservación de sesiones anteriores o completadas; no existe aún edición masiva, generación automática de festivos según país ni invitaciones recurrentes de videollamada.

## Hito 5: asistencia y finanzas por capas (2026-11-22)

- Finanzas manuales y asistencia se migraron a contextos DDD/hexagonales con casos de uso, puertos, adaptadores Prisma y controladores NestJS. Sin nuevas migraciones ni cambios en los contratos HTTP.
- La escritura de asistencia valida nuevamente la membresía, el profesor asignado, el estado de la reserva y la cancelación de la sesión dentro de una transacción PostgreSQL, usando el bloqueo compartido de clase.
- El backend incluye pruebas unitarias de roles y reglas de asistencia, y pruebas de integración PostgreSQL para aislamiento por academia, profesor y cancelaciones.
- La pantalla de asistencia utiliza componentes `@academy-os/ui`, transporte API compartido, estados de carga/error/guardado y evita mostrar valores no persistidos tras un fallo.
- El flujo sigue requiriendo validación de despliegue, OAuth real y pruebas de usuario; no significa que el producto esté listo para producción.

## Hito 6: Classroom — gestión de materiales (2026-11-22)

- El contexto Classroom migra recursos HTTPS a dominio, casos de uso, puertos y repositorio Prisma.
- Se conservan creación y consulta de materiales. Nuevo endpoint PATCH para publicar o retirar un borrador sin recrearlo.
- La administración verifica OWNER/ADMIN y scope de curso en la misma transacción; los alumnos ven solamente recursos publicados de cursos inscritos.
- La vista Gestión real incluye acciones publicar/retirar; los resultados de solicitudes antiguas no sobrescriben materiales al cambiar de academia.
- Los enlaces externos **no** son alojamiento seguro ni implican permisos garantizados de Drive/Dropbox. Los accesos OAuth siguen pendientes.

## Hito 7: sesiones individuales y cancelación (2026-11-23)

- Los flujos `GET /workspaces/:workspaceId/sessions`, `POST /sessions` y `PATCH /sessions/:sessionId/cancel` están migrados a DDD/hexagonal (dominio, puertos, casos de uso, Prisma y presentación NestJS) sin alterar sus rutas HTTP.
- La creación consulta rol, docente y curso dentro de transacción y serializa clases concurrentes por profesor. Respeta disponibilidad semanal, vacaciones/ausencias y clases existentes.
- Los docentes solamente consultan sesiones asignadas a su perfil; propietarios y administradores ven todas las sesiones de la academia.
- La cancelación revalida permisos, nunca cancela una clase completada, es idempotente cuando ya fue cancelada y publica avisos a estudiantes reservados en la misma transacción.
- Se añadieron pruebas unitarias y pruebas PostgreSQL para independencia de academias, permisos, simultaneidad, ausencias y avisos.
- **No** hay prueba real de OAuth Google ni despliegue HTTPS; CI no sustituye revisión de privacidad, permisos de enlaces externos o auditoría completa.

## Hitos 8–11 — migraciones de producto y staging (2026-11-23)

- Clase Viva, prácticas, Pasaporte y publicación docente migrados a DDD/hexagonal, con serialización de cambios y límite de tres intentos concurrentes.
- Invitaciones y onboarding OWNER migrados a Tenancy: aceptación de token único, email verificado, cuota diaria serializada e idempotencia de creación de academias.
- Profe Studio migrado a Commerce, con catálogo opt-in, servicios borrador y comprobaciones transaccionales de roles y cursos vinculados.
- Curriculum migrado a Academics con lectura y escritura limitadas a profesores asignados y managers del curso.
- Plantilla staging con PostgreSQL 19, Caddy HTTPS, Dockerfiles, scripts de respaldo/restauración y validación de Compose en CI.
- La plantilla no equivale a despliegue real; falta OAuth Google, pasarela, envíos y E2E con cuentas reales.

## Hito 12 — consultas privadas (2026-11-23)

- Historial personal de reservas migrado a Scheduling por capas: solo rol STUDENT, validación en Prisma y filtro por alumno y academia.
- Catálogo interno separado: directorio por Tenancy (personal OWNER/ADMIN, docentes STAFF) y Aula Digital por Classroom (material publicado en cursos inscritos).
- AppModule ya delega las rutas por academia a sus módulos; conserva el endpoint HTTP sin cambio de contrato.

## Hito 13 — Reservas recurrentes, festivos y aulas (2026-11-23)

- Reserva de todas las clases futuras confirmadas de una serie como una sola transacción, con control de aforo y matriculación e idempotencia para clases ya reservadas.
- Edición masiva de sesiones futuras en series, respetando histórico, DST local, ausencias, disponibilidad, capacidad mínima para reservas existentes, cambios auditados y avisos internos.
- Calendario de festivos nacionales de Colombia y restricción opcional por academia. Otros países no están soportados todavía.
- Sedes y aulas con disponibilidad y capacidad física, validación de academia y bloqueo de choques horarios entre profesores distintos.
- Gestión visual de estas funciones desde los paneles de profesores, administradores y alumnos; no equivale a pruebas manuales de usuarios.

## Hitos 14–15 — recordatorios, evidencias y metas (2026-11-23)

- Recordatorios internos opt-in para estudiantes, de 24 y 1 hora antes de clases confirmadas con reserva activa y matrícula; generación por worker independiente, idempotente y desactivado por defecto. No implica envíos por correo, push ni WhatsApp.
- Competencias evaluadas humanamente: evidencias inmutables y deduplicadas por requestId, cálculo transaccional de promedios y recuentos, aislamiento académico y del alumno.
- Metas por curso/alumno/tema con porcentaje objetivo y fecha opcional, estados ACTIVE/ACHIEVED/CANCELLED, motivo y eventos de auditoría.
- Interfaces docente y alumno conectadas con estas rutas. Se requiere QA manual, supervisión de worker y revisión de privacidad antes de pilotaje.

## Hito 16 — Vínculos familiares con autorización de academia (2026-11-23)

- GUARDIAN está permitido en invitaciones, pero ser miembro GUARDIAN no concede acceso a ningún estudiante.
- El vínculo se crea PENDING, se aprueba ACTIVE solo tras una declaración de verificación manual del manager y se puede revocar; los cambios se registran en GuardianLinkEvent.
- El acceso familiar comprueba el vínculo vigente, la academia, la membresía del alumno y el rol GUARDIAN; la proyección muestra únicamente nombres de cursos, métricas agregadas de competencias y estados de metas.
- Existen paneles de gestión y portal del acudiente. La validación legal de parentesco/identidad y el consentimiento de menores deben realizarse externamente y aún **no** están probados para producción.

## Hito 17 — marca e indicadores reales (2026-11-23)

- El catálogo de Profe Studio admite color HEX y URL HTTPS opcional de logo. El operador controla la URL externa; el editor muestra vista previa y el catálogo publica la identidad solo cuando la academia está habilitada.
- Los indicadores institucionales de 7/30/90 días provienen de consultas agregadas a PostgreSQL y se limitan a OWNER/ADMIN en una academia; no contienen filas personales de alumnos.
- Cobros: solo montos de recibos manuales no anulados, nunca facturación verificada ni ingresos bancarios conciliados. Aprendizaje: promedios reales por intento, distintos a competencias humanas.
- Aún no hay dominios DNS validados, pago en línea, estadísticas avanzadas ni reportes generados automáticamente.

## Hito 18 — Visión modular conectada y personalización (2026-11-23)

- Configuración de metodología por docente (especialidad, enfoque, idioma, texto de orientación), distinta para cada profesor, incluso dentro de la misma academia.
- Clase Viva y Profe SOS consumen esas preferencias bajo reglas de privacidad y fuentes publicadas; la IA sigue inactiva sin proveedor real.
- Profe SOS requiere habilitación del docente y consentimiento por consulta; además admite consultas directas al docente por curso, con respuestas y avisos internos.
- Perfil privado educativo basado en metas y evidencias verificadas: próximos pasos y logros confirmados; no genera etiquetas psicológicas ni evaluación IA.
- Catálogo público con ruta `/academy/:slug/`, manifiesto instalable y SVG de marca distintos por academia. Sin dominios personalizados reales ni instalación verificada en dispositivos.
- Producto diseñado para SOLO y ACADEMY sobre el mismo monorepo. Véase `PRODUCT_VISION.md` y `MODULE_INTEGRATION.md`.

## Hito 19 — Señales de refuerzo (2026-11-23)

- El panel de competencias presenta oportunidades agregadas de refuerzo de grupos, usando metas por tema con porcentaje definido por el profesor y evidencias humanas.
- Las señales distinguen casos con evidencia insuficiente de diferencias verificadas respecto a una meta; exigen dos alumnos por tema para mostrar una tarjeta.
- Solo docentes asignados y gestores de la academia pueden consultarlas; se deriva del mismo modelo de lectura de curso y no se ejecuta IA.
- La creación y aprobación real de actividades continúa ocurriendo en Clase Viva; no existen ejercicios automáticos enviados a alumnos a partir de estas señales.

## Hito 20/21 — Paquetes manuales y recursos de Clase Viva (2026-11-23)

- Los paquetes de clases tienen catálogo, emisión manual idempotente, saldos por estudiante y canje de créditos con bloqueo PostgreSQL; la cancelación devuelve créditos en transacción. No cobran dinero ni bloquean reservas sin paquete.
- Los administradores gestionan paquetes y precios orientativos; los alumnos pueden ver y aplicar sus créditos. El sistema no comprueba pagos de una pasarela.
- Clase Viva ahora permite flashcards y microlecciones con borradores editables, aprobación/publicación docente, validación de contenido y acceso solo para estudiantes matriculados.
- Las tarjetas de repaso son interactivas, pero su autoclasificación no se convierte automáticamente en evaluación humana del Pasaporte.
- Se añadió adaptador IA opcional para proponer ambos recursos bajo consentimiento explícito, cuota compartida y publicación exclusivamente humana; falta validar proveedor real.

## Hito 22 — Reservas con créditos obligatorios por curso (2026-11-23)

- Cada curso puede ser gratuito o exigir créditos de clase, por decisión de un OWNER/ADMIN.
- Reservas individuales y series semanales de cursos restringidos consumen créditos de paquetes manuales **durante la misma transacción** que la reserva, con control concurrente y sin reservas parciales.
- Activar el requisito de créditos se bloquea si hay reservas confirmadas futuras sin crédito. La política es gratuita por defecto y no cambia reservas históricas.
- Los alumnos ven la condición y los créditos se descuentan automáticamente; las cancelaciones devuelven los créditos.
- La condición no significa que exista checkout, verificación de pago, conciliación financiera, restricción de recursos premium ni suscripciones automáticas reales.

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
