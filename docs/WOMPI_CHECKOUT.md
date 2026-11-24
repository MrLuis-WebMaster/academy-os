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
