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
- [~] Plantilla staging HTTPS con Docker, Caddy, PostgreSQL y backup/restore manual en Git; faltan despliegue real, copias programadas y restauración probada.

## Etapa 1 — MVP operativo
- [x] Better Auth + Google, sesiones y onboarding self-service OWNER implementados en código.
- [x] Invitaciones de docente/alumno/admin, roles por espacio.
- [x] Materias, cursos, temas jerárquicos, docentes asignados, inscripciones.
- [x] Clases ONLINE/ONSITE/HYBRID con enlaces manuales; reservas, cancelación, cupos y registro de asistencia.
- [x] Aula Digital con materiales por curso, creación en borrador y publicación/retiro explícitos, visibles solo a inscritos.
- [x] Registro manual de cobros; no captura pagos externos.
- [x] Profe Studio con catálogo público, precio COP y contacto externo, desactivado por defecto.
- [ ] E2E de Google OAuth con credenciales reales y despliegue staging.
- [~] Reprogramación auditada y reservas existentes, franjas semanales, **ausencias y festivos manuales**, series semanales de 2–16 clases y notificaciones in-app transaccionales. Se implementaron festivos nacionales de Colombia con política opt-in, sedes/aulas y edición masiva de series. Faltan otros países, email/WhatsApp/push y sincronización de calendario.
- [ ] Checkout con pasarela, conciliación, reembolsos y facturación.
- [ ] E2E de flujos, privacidad/menores y auditoría multi-tenant integral.

## Etapa 2 — aprendizaje e integraciones
- [x] Clase Viva: observaciones y publicación de notas bajo supervisión humana.
- [x] Prácticas redactadas por profesores, corrección automática y hasta tres intentos.
- [x] Pasaporte inicial con resultados de prácticas y competencias basadas únicamente en evidencias revisadas por docentes, además de metas con estados auditables.
- [~] Generación de **prácticas** con OpenAI Responses API, opt-in y revisión/edición docente, diez usos diarios compartidos por academia; pendiente validar con API key real. Resúmenes generados automáticamente aún no implementados.
- [~] Profe SOS con acceso limitado a **notas publicadas** de cursos inscritos, referencias a las clases y derivación al profesor; pendiente probar API externa y añadir otros materiales autorizados.
- [x] Exportación privada de calendario `.ics` filtrada por rol (importación manual, sin OAuth).
- [ ] OAuth Meet/Calendar, Zoom y Google Drive con lifecycle, revocación y tests.
- [ ] Almacenamiento propio y revisión de seguridad de recursos.
- [x] Bandeja in-app con leído/no leído y notificaciones de matrículas, reservas y cambios de clases, con entrega transaccional e idempotente, sin envíos externos.
- [~] Preferencias opt-in por estudiante y academia, worker de recordatorios 24h/1h internos e idempotencia PostgreSQL. Falta activación en servidor, email/push/WhatsApp con consentimiento externo y monitoreo.

## Etapa 3 — academia y white-label avanzados
- [~] Roles GUARDIAN, invitaciones, aprobación manual de vínculo y portal familiar de consulta restringida. Faltan verificación legal/identidad por proveedor, consentimiento de menores, retención, auditoría externa y validación E2E.
- [~] Series semanales de clases, todas o ninguna, con validación DST y conflictos; cancelación masiva de futuras sesiones con avisos in-app, sin alterar clases anteriores. Edición masiva de futuras sesiones y reservas recurrentes de alumnos implementadas.
- [~] Sedes y aulas con exclusión de horarios y capacidad; faltan docentes sustitutos y recursos complementarios.
- [~] Color de marca y logo HTTPS para la academia/catálogo público; faltan dominios personalizados con validación DNS, multimoneda y planes comerciales.
- [ ] OneDrive, Dropbox, Outlook/Teams y más conectores.
- [ ] Instancias dedicadas con activación segura del propietario.
- [~] Dashboard institucional agregado por período con datos reales de matrículas, agenda, prácticas, evidencias y comprobantes manuales. Faltan informes avanzados, soporte, facturación, backups, observabilidad y lanzamiento.

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

## Hito 12 — Modelos de lectura privados
- [x] Historial privado de reservas migrado a caso de uso, puerto y adaptador PostgreSQL bajo rol STUDENT.
- [x] Directorio (personas y docentes) separado en Tenancy; emails visibles únicamente a OWNER/ADMIN.
- [x] Consulta Aula Digital del alumno en Classroom con filtro de matrícula, materiales publicados y sesiones de la academia.
- [x] Pruebas de regresión de acceso, aislamiento de academia y ruta conservada.

## Hito 13 — Agenda avanzada (2026-11-23)
- [x] Reservas recurrentes futuras de alumnos y cancelación de reservas propias, ambas transaccionales y aisladas por academia.
- [x] Edición masiva de próximas clases semanales con validación DST, permisos, disponibilidad, capacidad, auditoría y avisos internos.
- [x] Calendario calculado de festivos de Colombia, incluidas Leyes 51/1983 y 2578/2026, opcional por academia y sin cambios retroactivos.
- [x] Sedes y aulas, aforo y exclusión de horario físico; selección en la gestión de clases y series.
- [x] Pruebas PostgreSQL y CI de reservas concurrentes, calendario, series y aulas.
- [ ] Ferias/feriados de otros países y regiones, suplencias, integraciones de proveedores y QA manual.

## Hito 14 — Recordatorios internos opt-in (2026-11-23)
- [x] Preferencias de recordatorio independientes por estudiante y academia, desactivadas por defecto.
- [x] Avisos internos para clases reservadas 24h y/o 1h antes, sin duplicación por reintentos.
- [x] Worker independiente, no conectado a un proveedor externo y desactivado por defecto.
- [x] Pruebas PostgreSQL de consentimiento, matrícula, reservas activas e aislamiento multi-tenant.
- [ ] Configurar proceso supervisado, métricas, alarmas y continuidad antes de activar; canales externos por integrar.

## Hito 15 — Evidencias y metas de aprendizaje (2026-11-23)
- [x] Evidencias docentes append-only por competencia/tema; registro idempotente, evaluador y fecha.
- [x] Dominio de competencias con promedio de valoraciones humanas (0–100) y cantidad de evidencias; nunca atribuir dominio a IA.
- [x] Metas de aprendizaje por alumno/curso/tema, estados controlados y auditoría de transiciones.
- [x] Acceso restringido por matrícula y docente asignado, paneles de docentes/alumnos y pruebas PostgreSQL.
- [ ] Rubricas complejas, plazos automatizados, corrección de evidencia con registro de reversión, analítica institucional y QA de usuarios.

## Hito 16 — Acceso familiar con aprobación explícita (2026-11-23)
- [x] Invitaciones al rol GUARDIAN, sin permisos automáticos sobre alumnos.
- [x] Vínculos específicos acudiente/estudiante por academia, primero PENDING y solo ACTIVE tras aprobación administrativa explícita.
- [x] Revocación por administrador, acudiente o alumno; la reactivación requiere nueva aprobación y se registran transiciones.
- [x] Portal familiar limitado a cursos, competencias evaluadas y estados de metas, sin links privados, mensajes ni notas docentes.
- [x] Pruebas de autorización y aislamiento por academia en PostgreSQL.
- [ ] Integrar verificación legal de identidad/representación, consentimientos parentales y políticas de privacidad/retención para menores.

## Hito 17 — Branding y analítica institucional (2026-11-23)
- [x] Profe Studio permite configurar color HEX de marca y URL de logo HTTPS, con vista previa y proyección pública controlada.
- [x] Estadísticas en tres períodos (7, 30 y 90 días), solo OWNER/ADMIN, calculadas a partir de registros reales del workspace.
- [x] Panel web de KPIs de estudiantes, docentes, cursos, sesiones, reservas, asistencia, intentos, evidencias y recibos manuales.
- [x] Pruebas de validación de branding, roles, aislamientos y consultas PostgreSQL.
- [ ] Dominios personalizados verificados, informes exportables, planes y entitlements, almacenamiento propio de logos y métricas de operación.

## Hito 18 — Producto modular conectado y metodología docente (2026-11-23)
- [x] Decisión de producto: una plataforma multi-tenant para SOLO y ACADEMY; cinco módulos integrados, sin apps/código exclusivos por cliente.
- [x] Metodología por profesor: especialidad, estilo, idioma, instrucciones y habilitación individual de Profe SOS, con permisos backend por academia/docente.
- [x] Clase Viva considera la metodología del docente al proponer borradores; Profe SOS la usa como preferencia no privilegiada y solo si el profesor habilita su asistente.
- [x] Dudas del alumno enviadas manualmente al profesor de su curso, respuestas privadas y avisos internos transaccionales, con cuota de pendientes y permisos multi-tenant.
- [x] Perfil educativo derivado de metas y evidencias humanas, próximos pasos y logros sin perfilado psicológico; visible localmente en Pasaporte y Profe SOS.
- [x] Ruta pública por academia, manifiesto e icono PWA personalizados; cada academia publicada tiene id y alcance de instalación propios.
- [ ] Validación de PWA instalable en dispositivos reales, iconos PNG/Apple, dominios HTTPS personalizados y DNS propio.
- [ ] Audio, transcripción, flashcards, microlecciones, enseñanza especializada, pagos por pasarela, paquetes/membresías e integración del proveedor IA real.

## Hito 19 — Refuerzos de grupo basados en evidencia (2026-11-23)
- [x] Identificación de temas con **al menos dos** estudiantes cuya competencia evaluada por docentes está por debajo de una meta activa configurada.
- [x] Separación estricta de temas sin evidencia (pendientes de evaluación) y metas por debajo de valoraciones verificadas (posible refuerzo).
- [x] Deduplificación de alumnos con varias metas en el mismo tema; sin inferir patrones psicológicos, estilos de aprendizaje o diagnósticos.
- [x] API limitada a OWNER/ADMIN o docente asignado al curso, panel de oportunidades y selección del tema para planificar refuerzo en Clase Viva.
- [x] Pruebas del dominio y con PostgreSQL para cálculos reales, cambios de metas y permisos.
- [ ] Generar propuestas diferenciadas por especialidad educativa (audio/speaking, matemáticas guiadas, música, arte, simulacros) y validar prácticas con profes reales.

## Hito 20 — Bonos de clases manuales (2026-11-23)
- [x] Catálogo por academia con curso, cantidad de sesiones, vigencia, precio de referencia y activación.
- [x] Emisión manual a alumnos bajo rol OWNER/ADMIN con clave idempotente y validación de matrícula.
- [x] Saldo privado, aplicación de crédito a reservas y bloqueo concurrente por asignación.
- [x] Devolución de créditos en cancelación de reserva, cancelación de clase y series futuras, dentro de las mismas transacciones.
- [x] Interfaces de administración y estudiante y pruebas PostgreSQL de aislamiento, idempotencia y concurrencia.
- [ ] Compras autoservicio, validación de pagos, requisitos de acceso a clases de pago, renovaciones automáticas y membresías recurrentes reales.

## Hito 21 — Clase Viva: tarjetas y microlecciones (2026-11-23)
- [x] Borradores de flashcards y microlecciones editables por profesores, con publicación humana y contenidos validados.
- [x] Publicación únicamente tras publicar las notas de clase vinculadas; estudiantes inscritos solo ven recursos publicados de su curso.
- [x] Tarjetas interactivas de repaso, pasos guiados y seguimiento temporal de autoevaluación, sin sumar a dominio certificado.
- [~] Generador IA opcional de ambos tipos con cuota por academia, minimización best-effort, consentimiento por acción y aprobación docente. Pendiente probar proveedor externo real.
- [x] Pruebas de esquema y autorización, y pruebas PostgreSQL sobre aislamiento y publicación.
- [ ] Audios, transcripción, repetición espaciada persistente, actividades especializadas y multimedia accesible.

## Hito 22 — Política de reserva de cursos con créditos (2026-11-23)
- [x] Cursos gratuitos por defecto; activación explícita de requisito de crédito por curso solo por OWNER/ADMIN.
- [x] Bloqueo de política compartido con las reservas para impedir activación mientras existan nuevas reservas sin crédito.
- [x] Cada nueva reserva individual o semanal exige y consume automáticamente un crédito válido de un paquete manual para cursos restringidos.
- [x] Reservas semanales completamente atómicas: sin saldo suficiente no se confirma ninguna clase de la serie.
- [x] Crédito asignado y cupo confirmados en una sola transacción; no se admiten reintentos duplicados ni créditos de otro curso.
- [x] Devoluciones automáticas y permiso/matrícula revalidados. Interfaz de administrador y avisos de consumo para alumnos.
- [x] Suite PostgreSQL para política, carreras por último crédito y series de pago.
- [ ] Checkout validado, conciliación monetaria, suscripción recurrente y protección de materiales de cursos premium.

## Hito 23 — Auditoría y revocación de paquetes (2026-11-23)
- [x] Historial administrativo aislado por academia y rol OWNER/ADMIN, con emisor, estudiante, paquete, saldo, consumos y reservas futuras.
- [x] Revocación con motivo, fecha e identidad del administrador; notificación privada al alumno e idempotencia.
- [x] Revocación prohibida si existen reservas futuras confirmadas respaldadas por el paquete; debe cancelarse y devolverse primero.
- [x] Bloqueo concurrente por asignación compartido con consumo automático de crédito y revalidación en transacción.
- [x] UI administrativa, pruebas de control de acceso, reconciliación de saldo y no duplicar avisos.
- [ ] Exportación CSV de auditoría, conciliación bancaria real, soporte de reembolso monetario, múltiples roles de contabilidad y política legal de retención.


## Hito 24 — exportación administrativa de créditos (2026-11-23)
- [x] El panel de paquetes permite descargar CSV del historial de asignaciones autorizado por el backend y filtrado por academia.
- [x] El CSV incluye emisor, alumno, paquete, referencias, créditos, fechas, revocación y reservas futuras; serialización UTF-8 y mitigación de inyección de fórmulas de hoja de cálculo.
- [x] Pruebas de exportación, escapado y nombre de archivo incorporadas a CI (`pnpm commerce:csv:test`).
- [ ] Validación con navegadores y hojas de cálculo reales, exportación paginada completa y controles de retención/privacidad, reservadas para una etapa posterior.
- [ ] El CSV no certifica pagos, no sustituye contabilidad y solo cubre las últimas 200 asignaciones que devuelve el endpoint.


## Hito 25 — Google Calendar y Meet, conexión y exportación individual
- [x] OAuth separado del login, PKCE, scopes limitados, estado temporal vinculado a la cuenta y academia, cifrado autenticado de credenciales.
- [x] Desconexión local y cancelación de solicitudes pendientes, renovación de access token y CAS de credenciales.
- [x] Exportación explícita de clases: alta, edición y retirada de eventos privados, ID determinista, permiso docente por asignación, opción Meet para clases virtuales/híbridas.
- [x] Interfaz de Gestión real, configuración desactivada por defecto, preflight y tests simulados agregados a la suite.
- [ ] Sincronización automática con outbox, recuperación/conciliación y revocación remota; publicación segura del enlace de Meet en la clase, pruebas PostgreSQL de carreras del nuevo contexto y validación de proveedor real.
- [ ] Zoom, Google Drive y restantes conectores.


## Hito 26 — publicación Meet y sincronización Calendar por clase
- [x] Publicación opt-in del enlace generado por Google con comprobaciones de membresía, conexión y estado de clase en transacción; no acepta URLs arbitrarias desde el cliente.
- [x] Aula Digital muestra enlaces de reunión únicamente a estudiantes matriculados con reserva activa; refresco tras reservas y cancelaciones.
- [x] Suscripciones de sincronización opt-in por clase, revisiones persistentes, cola transaccional para cambios de título/horario/estado y worker con lease, reintentos y estado de revisión.
- [x] Interfaz para autorizar, consultar o detener sincronización; perfil Docker Compose desactivado por defecto; tests simulados y de PostgreSQL añadidos.
- [ ] Confirmar CI, validar OAuth/Meet y sincronización con proveedor real; verificar recuperación, límites, condiciones de carrera con ediciones externas y monitoreo. La sincronización es unidireccional desde AcademyOS y no recrea eventos remotos eliminados automáticamente.


## Hito 27 — archivos privados de curso
- Carga de PDF/PNG/JPEG con límite de 5 MiB, cuota de 100 MiB y 200 archivos por academia, almacenamiento PostgreSQL con metadatos y contenido transaccionales.
- Gestión por OWNER/ADMIN y docentes asignados; publicación explícita, retirada, eliminación y descargas autenticadas para alumnos matriculados. Sin IA ni enlaces públicos.
- UI conectada y pruebas de dominio y PostgreSQL añadidas. Migración z9_private_material_files. Desactivado por defecto.
- Pendientes: CI confirmado, pruebas HTTP y navegador, antivirus/cuarentena, almacenamiento de objetos a escala, límites de tasa y conectores Drive/Dropbox/OneDrive. Ver [PRIVATE_FILES.md](PRIVATE_FILES.md).


## Hito 28 — solicitudes de compra y entrega de paquetes
- Catálogo elegible del alumno, orden con snapshot de precio/créditos, estados e historial.
- Revisión de OWNER/ADMIN, referencia externa única, importe comprobado manualmente y entrega transaccional e idempotente de créditos con aviso interno.
- Pantallas de estudiante y gestión, migración za_package_orders, flag desactivado por defecto y pruebas PostgreSQL añadidas.
- Pendientes CI, pruebas de interfaz y pasarela real con eventos firmados, conciliación y suscripciones. Ver [PACKAGE_ORDERS.md](PACKAGE_ORDERS.md).


## Hito 29 — planes SaaS y administración de plataforma inicial
- Planes STARTER/PRO/ACADEMY con asignación manual, expiración y auditoría. Operadores allowlisted por ID y cuenta verificada; consulta de plan y consumo por academia.
- Límites provisionales de alumnos, profesores y almacenamiento aplicados en aceptación de invitaciones y nuevas cargas cuando el flag está activo. Sin eliminación de datos por downgrade.
- Panel de plan/uso y asignación inicial, migración zb_saas_plans y pruebas PostgreSQL añadidas.
- Pendientes CI, consola global independiente, vista de auditoría, cuotas IA, precios, cobros y renovaciones reales. Ver [SAAS_PLANS.md](SAAS_PLANS.md).

## Hito 30 — consola global y cuotas de IA
- [x] Ruta /platform independiente del espacio educativo, protegida por operador autorizado y verificado; resumen global, asignación y auditoría paginada.
- [x] Límites diarios compartidos de IA por plan, visualización de consumo y bloqueo coordinado con cambios de plan; modo informativo conserva 10 intentos por día.
- [x] Pruebas de autorización, paginación y cuota concurrente añadidas; cuatro comprobaciones aisladas de dominio ejecutadas exitosamente.
- [ ] CI, compilación y pruebas de PostgreSQL/navegador confirmadas; validación real, medición de tokens/costes, facturación y pasarela.


## Hito 31 — checkout Wompi para paquetes (piloto)
- Checkout alojado COP, firma y expiración del servidor, referencia persistida, webhook con checksum y consulta autenticada al proveedor.
- UI del alumno y gestor, sandbox sin créditos, camino de entrega transaccional de producción desactivado por defecto; revisión de incompatibilidades/anulaciones. Una academia piloto por instalación.
- Migración zc_package_checkout y pruebas simuladas/PostgreSQL añadidas, sin ejecución confirmada. Pendientes sandbox real, conciliación, recuperación de checkout, reembolsos, múltiples comercios y facturación SaaS. Ver [WOMPI_CHECKOUT.md](WOMPI_CHECKOUT.md).

## Hito 32 — recuperación y conciliación de checkout
- Consulta autenticada por ID de Wompi desde alumno titular y gestor, retorno informativo y formulario reutilizable; verificación del servidor y entrega idempotente.
- Worker opt-in de transacciones pendientes con ID conocido, leases, backoff, 12 intentos y estados visibles. Migración zd_checkout_reconciliation y perfil Compose. Pruebas añadidas, CI no confirmado.
- Pendientes: inbox de eventos durables, casos sin ID, reembolsos, checkout vencido, múltiples comercios y facturación SaaS. Ver [WOMPI_CHECKOUT.md](WOMPI_CHECKOUT.md).

## Hito 33 — comercios Wompi independientes (sandbox)
- Configuración por OWNER verificado, cifrado AES-GCM ligado a academia, unicidad de llave pública, pausa de nuevas compras y continuidad de conciliación.
- Resolución de pasarela por academia, webhook aislado, worker paginado, UI de configuración y migración ze_workspace_wompi_merchants. Piloto anterior conservado.
- Pruebas añadidas, CI no confirmado. Solo sandbox; pendientes verificación de titularidad, rotación, reembolsos, inbox durable, producción multi-comercio y cobros SaaS. Ver [WOMPI_CHECKOUT.md](WOMPI_CHECKOUT.md).

## Hito 34 — bandeja durable de eventos de pago
- Recepción firmada, huella única por comercio/academia/ambiente, persistencia mínima antes de respuesta y worker con leases y reintentos.
- Historial paginado y reintento de fallidos por OWNER/ADMIN; reutiliza verificación y entrega idempotente. Flag apagado por defecto, requiere worker. Migración zf_payment_event_inbox y pruebas añadidas.
- Pendientes CI/sandbox, rate limiting, retención, alertas operativas, disputas/reembolsos y facturación SaaS. Ver [WOMPI_CHECKOUT.md](WOMPI_CHECKOUT.md).


## Hito 35 — gestión de incidencias y devoluciones externas
- Expedientes por orden, notas y auditoría de acciones, cierre/reapertura; devoluciones externas totales/parciales registradas con confirmación, referencia e importe máximo acumulado. Panel OWNER/ADMIN y migración zg_package_payment_cases.
- Pruebas añadidas de aislamiento, concurrencia e idempotencia, sin ejecución confirmada. No se envían fondos, no se verifican devoluciones con Wompi, no se revocan créditos automáticamente. Ver [WOMPI_CHECKOUT.md](WOMPI_CHECKOUT.md).


## Hito 36 — facturación SaaS independiente
- Solicitudes PRO/ACADEMY mensuales/anuales, precios configurables sin valores predeterminados, confirmación externa por operador, referencia única, periodo de vigencia/renovación y protección del periodo pagado. Panel de academia y plataforma, migración zh_saas_billing_orders.
- Pruebas añadidas, CI no confirmado. Flag apagado por defecto; no hay checkout de plataforma ni cobros automáticos. Pendientes pasarela, facturación fiscal, cambios de plan y conciliación. Ver [SAAS_PLANS.md](SAAS_PLANS.md).


## Hito 37 — correo transaccional opt-in
- Cola durable derivada de avisos internos, preferencias por alumno/academia, revalidación antes de envío, deduplicación, leases y reintentos; adaptador Resend y panel de preferencias. Migración zi_email_notice_delivery y perfil Compose email-notices.
- Mensajes genéricos sin detalles académicos sensibles; flag apagado por defecto. Pruebas añadidas, CI y proveedor real sin confirmar. Pendientes rebotes/quejas, supervisión, límites, comunicación docente, push/WhatsApp. Ver [REMINDER_DELIVERY.md](REMINDER_DELIVERY.md).
