# Wompi checkout pilot
Hito 31 — pagos de alumnos a una academia, separados de la facturación del SaaS.

## Alcance
Checkout web alojado en Wompi Colombia (COP), un comercio/academia piloto por instalación. No se manejan tarjetas en AcademyOS. El servidor genera una referencia única, importe en centavos desde la orden persistida y firma SHA-256 con expiración de 30 minutos. La URL solo lleva la llave pública y parámetros firmados. El retorno del navegador es informativo, nunca una prueba de pago.

La ruta POST /api/v1/payments/wompi/events valida ambiente, checksum y campos firmados del evento. Consulta después GET /v1/transactions/{id} con la llave privada del comercio en el servidor, para comprobar referencia, moneda, importe e identidad de la transacción. No almacena el payload completo, correo del pagador ni datos de tarjeta. Se registra el estado de verificación y el ID de transacción. No se confía en la referencia del evento cuando no está firmada.

El checkout de sandbox registra TEST_APPROVED, sin emitir créditos. En producción, una transacción aprobada con importe correcto y referencia vinculada, orden pendiente, matrícula vigente y propietario verificado asignado al comercio permite entregar créditos y aviso interno en una transacción. Reintentos concurrentes no deben emitir dos asignaciones. Un pago incompatible, anulación posterior o cambio de referencia requiere revisión. Los pedidos con checkout no se pueden entregar por el flujo manual. No se reembolsan fondos ni se revocan créditos automáticamente por anulaciones. Las órdenes productivas pendientes de conciliación no se cancelan automáticamente. Un checkout vencido o sin evento puede requerir intervención; no se ofrece aún una operación de cierre/reintento de checkout productivo.

## Configuración de piloto (solo después de aplicar migración zc_package_checkout)
- ACADEMY_PACKAGE_ORDERS_ENABLED=true
- ACADEMY_WOMPI_ENABLED=true
- ACADEMY_WOMPI_ENVIRONMENT=test
- ACADEMY_WOMPI_WORKSPACE_ID: ID de academia de pruebas.
- ACADEMY_WOMPI_PUBLIC_KEY, ACADEMY_WOMPI_PRIVATE_KEY, ACADEMY_WOMPI_INTEGRITY_KEY, ACADEMY_WOMPI_EVENTS_KEY: claves del mismo comercio y ambiente, guardadas en secretos de servidor.
- Registrar URL de eventos sandbox en Wompi: https://<dominio>/api/v1/payments/wompi/events.
- Mantener ACADEMY_WOMPI_LIVE_ENABLED=false. En producción el código exige prod, activación explícita y ACADEMY_WOMPI_ISSUER_ID de un OWNER verificado de esa academia; no se ha validado y no se recomienda habilitar aún. No cambiar credenciales ni ambiente mientras existan transacciones pendientes; desactivar la integración también detiene el procesamiento de eventos.

## Validación y pendientes
Pruebas añadidas: wompi-checkout.test.ts (firma, manipulación, verificación API simulada), package-checkout-postgres.test.ts (aislamiento, sandbox, entrega idempotente y anulación). No se han ejecutado pagos reales ni se ha confirmado CI o build. Antes de producción: sandbox real, conciliación activa de pagos sin webhook, cola y reintentos durables, recuperación de checkout vencido, manejo de disputas/reembolsos y contracargos, límites de tasa, trazabilidad contable, seguridad de secretos por academia y rotación, impuestos y facturación. La facturación SaaS recurrente es independiente y sigue pendiente.

Referencias oficiales:
- https://docs.wompi.co/docs/colombia/widget-checkout-web/
- https://docs.wompi.co/docs/colombia/eventos/
- https://docs.wompi.co/docs/colombia/transacciones/


## Hito 32 — conciliación y recuperación
- El retorno de Wompi lleva el ID de transacción como parámetro de URL (documentación oficial Widget & Checkout Web, paso 4). AcademyOS lo propone en la solicitud correspondiente, si el alumno sigue en el espacio correcto y conserva la sesión. Si no, el alumno o gestor puede indicar el ID manualmente. No se considera evidencia de pago hasta consultar al proveedor.
- POST /api/v1/workspaces/:workspaceId/package-checkout/:orderId/reconcile exige sesión, origen y rol OWNER/ADMIN o STUDENT titular de la orden. Verifica comercio, ambiente y referencia exacta antes de reutilizar la entrega idempotente. El ID es únicamente una pista, no una afirmación confiable.
- El worker opt-in consulta transacciones PENDING ya identificadas, con leases persistentes de 120 segundos y máximo 12 comprobaciones automáticas, intervalos crecientes de hasta 30 minutos si sigue pendiente o 60 si falla el proveedor. Se procesan hasta cinco por ciclo de 60 segundos. El panel del gestor informa errores y agotamiento; puede consultar manualmente. No se hacen cargos ni devoluciones desde el worker. No se consulta por referencia sin ID: si no llega ni webhook ni retorno con ID, se requiere encontrarlo en el panel de Wompi. Una anulación posterior a aprobación puede detectarse por webhook o consulta manual, no por este worker de pendientes.
- Aplicar migración zd_checkout_reconciliation. Activar ACADEMY_PAYMENT_RECONCILIATION_ENABLED=true únicamente junto con la configuración de sandbox validada. Perfil Compose payment-reconciliation, sin puertos públicos, depende del API saludable. Comando local/compilado: pnpm --filter @academy-os/api worker:payment-reconciliation (opción --once). Por defecto desactivado.
- Se añadió un formulario Vue reutilizable para recuperar el pago desde alumno y gestor. Evita reabrir el checkout si ya tiene un ID de transacción. La consulta manual sigue disponible para casos pendientes y cerrados.
- Pruebas nuevas de recuperación por ID, rechazo de referencia ajena, backoff, concurrencia y leases PostgreSQL. Suite completa y CI no confirmados; no se ejecutaron transacciones reales.
- Pendientes antes de producción: inbox durable para eventos firmados cuyo GET falle antes de vincular ID, limitación de tasa, resolución administrativa formal de casos sin ID o en disputa, recuperación segura de checkout vencido, múltiples intentos de pago por orden, reembolsos y conciliación bancaria real. El worker no sustituye la contabilidad ni garantiza detectar todos los pagos desconocidos. No habilitar producción todavía.


## Hito 33 — comercios sandbox por academia
- Migración ze_workspace_wompi_merchants: una cuenta sandbox independiente por workspace, llave pública identificada por SHA-256 único, credenciales cifradas con AES-256-GCM y AAD que incluye workspace y hash de comercio. No se devuelven claves en las respuestas de gestión.
- Solo OWNER con email verificado configura o pausa las compras. PUT y PATCH requieren origen web autorizado. El formulario comprueba formato, no valida aún que las cuatro claves pertenezcan a un comercio real. La activación exige confirmación del gestor y no cobra dinero real.
- ACADEMY_WORKSPACE_WOMPI_ENABLED=false por defecto. Para pruebas, habilitar junto a ACADEMY_PACKAGE_ORDERS_ENABLED y configurar ACADEMY_MERCHANT_ENCRYPTION_KEY con 32 bytes aleatorios en hexadecimal (secreto independiente de OAuth). Proteger y respaldar la llave; perderla impide recuperar credenciales. No rotar la llave sin una migración segura.
- Endpoint de eventos por academia: /api/v1/payments/wompi/workspaces/:workspaceId/events. Registrar URL de sandbox que muestra el panel. Se resuelve únicamente el comercio del workspace y se verifica firma y transacción con sus propias claves. El webhook anterior continúa para el piloto configurado por entorno.
- Pausar nuevas compras no bloquea el webhook ni la consulta de pagos existentes. El worker recorre páginas de hasta 10 comercios y un pendiente por comercio por ciclo, además del piloto. El flag global desactivado sí detiene las verificaciones por academia.
- No se permite sustituir credenciales si existe historial de checkout. No configurar el mismo comercio en piloto y en DB; el piloto activo tiene prioridad. No habilitar producción multi-comercio hasta implementar verificación de titularidad, rotación/versionado de secretos, inbox durable de eventos, conciliación completa, resolución de disputas y pruebas de seguridad. Sandbox nunca entrega créditos.
- Pruebas añadidas en workspace-wompi-merchants.test.ts: validación de formatos, cifrado ligado al workspace, autorización de propietario, unicidad, pausa y aislamiento de transacciones. No se confirmó ejecución de CI ni integración real.


## Hito 34 — bandeja durable de webhooks
- Migración zf_payment_event_inbox. Con ACADEMY_PAYMENT_INBOX_ENABLED=true (por defecto false), el webhook valida firma y ambiente con el comercio correcto y guarda un registro mínimo antes de devolver HTTP 200. Si la base falla, no confirma recepción. El modo anterior síncrono se conserva con flag apagado.
- Guarda únicamente hash del checksum firmado, ID, importe firmado, estado firmado, comercio, ambiente, academia y metadatos de procesamiento. No guarda referencia no firmada, payload original, correo ni información de tarjeta. Duplicados exactos se deduplican mediante índice único por workspace/ambiente/comercio/huella.
- El worker existente consulta nuevamente la API autenticada del proveedor, comprueba ID e importe, toma la referencia y el estado actuales de esa consulta y reutiliza el cumplimiento transaccional e idempotente. Leases de 120 segundos, reintentos persistentes con backoff 1–60 minutos y máximo 12 intentos; se recuperan leases vencidos. Procesa hasta cinco eventos por ciclo del piloto y dos por comercio de la página de hasta diez academias; además conserva la conciliación de transacciones pendientes.
- Estados: QUEUED, DONE, IGNORED (referencia no asociada), REVIEW (incompatibilidad o caso que requiere revisión), FAILED (reintentos agotados). DONE significa evento procesado, no necesariamente pago aprobado; puede resolver WAITING. OWNER/ADMIN consulta historial paginado y devuelve FAILED a la cola; no puede alterar evidencias ni marcar pagos como aprobados. REVIEW no se libera automáticamente.
- Activar ACADEMY_PAYMENT_RECONCILIATION_ENABLED=true, perfil Compose payment-reconciliation, y confirmar que el worker está activo ANTES de habilitar el inbox. Preflight valida dependencia de flags, no disponibilidad real del worker. No desactivar pasarela/llaves mientras haya eventos pendientes. Pausar solo nuevas compras por academia no detiene recepción. Cambiar credenciales con historial de eventos está bloqueado.
- Pruebas añadidas de firma, payload mínimo, fallo de persistencia, reintentos, deduplicación concurrente, leases e aislamiento (payment-event-inbox.test.ts y payment-event-inbox-postgres.test.ts). CI y sandbox real no confirmados.
- Límites: no se garantiza descubrir un pago si jamás llega el webhook ni se conoce el ID; no se resuelven reembolsos/contracargos ni se cobra el SaaS. Pendientes rate limiting, retención/archivo, alertas operativas, auditoría del reintento manual, versionado/rotación de secretos y revisión de producción. Los registros dependen de la vida del workspace (borrado en cascada), no son un libro contable inmutable.


## Hito 35 — expedientes de pago y devoluciones externas
- Migración zg_package_payment_cases: un expediente por orden entregada o checkout en REVIEW_REQUIRED, con categoría REFUND, DISPUTE o PAYMENT_REVIEW, estado OPEN/CLOSED, notas, cierre/reapertura y diario de acciones con actor, fecha y request ID idempotente.
- API OWNER/ADMIN con comprobación de pertenencia en repositorio y origen para mutaciones. Listado paginado de órdenes elegibles; detalle con últimos 100 movimientos. Panel Incidencias y devoluciones en Gestión real.
- Registros de devolución total o parcial requieren confirmación explícita de que ya se efectuó fuera de AcademyOS, referencia externa y monto entero COP. Solo compras FULFILLED con pago registrado y, para checkout, ambiente prod y transacción vinculada APPROVED/VOIDED. No se registran devoluciones de sandbox ni se presume cobro en una orden pendiente, aunque el checkout esté en revisión. Casos de cobro sin entrega permiten notas y seguimiento, no contabilizar devoluciones todavía.
- Suma acumulada limitada al importe original y referencias de devolución únicas dentro de la orden. Bloqueos transaccionales por orden y request ID evitan duplicar acciones y superar el importe en operaciones concurrentes. No verifica la referencia externa con el banco; no constituye contabilidad ni evidencia independiente de devolución.
- No llama a APIs de reembolso, no mueve fondos, no altera estado de compra, no libera automáticamente REVIEW_REQUIRED ni revoca créditos. El gestor conserva el flujo existente de revocación con control de reservas futuras. Los expedientes son privados de administración; no notifican al alumno. El diario no permite edición/borrado por API, pero se elimina en cascada con la orden y no es inmutable legalmente.
- Pruebas añadidas en payment-cases.test.ts para confirmación, montos parciales concurrentes, repetición idempotente, duplicados, aislamiento, cierre/reapertura y sandbox. No se confirmó ejecución ni CI.
- Pendientes: reembolso real según medios admitidos por el proveedor, conciliación contable, referencias globales de devolución, historial completo paginado/exportable, solicitudes y seguimiento por alumno, resolución de cobros sin entrega, política comercial y disputas. Validación de producción sigue pendiente.
