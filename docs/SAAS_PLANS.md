# SaaS plans — AcademyOS
Hito 29: asignación manual de planes de plataforma, distinta de las compras de paquetes de alumnos.

| Plan | Alumnos (membresías STUDENT) | Profesores (perfiles, incluido titular) | Archivos privados |
|---|---:|---:|---:|
| STARTER | 30 | 1 | 25 MiB |
| PRO | 150 | 5 | 50 MiB |
| ACADEMY | 1000 | 30 | 100 MiB |

Límites provisionales de producto, no precios contratados. Mantienen el máximo operativo de almacenamiento PostgreSQL existente. Sin asignación o al vencer una asignación, se aplica STARTER. El vencimiento no elimina alumnos, profesores ni archivos; solo restringe nuevas altas bajo los límites implementados. No se cobra, factura ni renueva automáticamente.

## Administración
- Configurar `ACADEMY_PLATFORM_OPERATOR_IDS` con IDs de usuarios de plataforma explícitamente autorizados y verificados. Vacío por defecto: no hay operadores. Nunca aceptar roles de plataforma desde la UI ni compartir esa lista con el cliente.
- OWNER/ADMIN consulta el plan y el uso de su propia academia. Operador autenticado y verificado puede listar academias por páginas de 50, asignar planes con vencimiento y motivo, mediante endpoints /platform. La UI inicial se muestra en Gestión real a un operador que también tenga una academia administrada.
- Cada asignación crea un registro de auditoría transaccional. No es un libro contable inmutable; eliminación de academia elimina su historial.
- Activar `ACADEMY_SAAS_QUOTAS_ENABLED=true` solo después de revisar uso de academias existentes. Por defecto es informativo. Las comprobaciones de cuota están integradas en aceptación de invitaciones STUDENT/TEACHER y subida de archivos privados, con bloqueo compartido para cambios de plan. No limitan todas las funcionalidades ni otras vías futuras de creación de miembros. El límite de 200 archivos y 5 MiB por archivo permanece.
- Aplicar migración `zb_saas_plans`. Pruebas en `apps/api/src/integration/saas-plans.test.ts`: expiración, aislamiento, autorización de operador y cuota de profesores.
- Pendiente: probar CI y navegador, administración global independiente del workspace, vista de auditoría, límites de IA y otras funcionalidades, precios, checkout, facturación recurrente, conciliación y webhooks firmados. No habilitar cuotas en producción sin revisar datos y casos de carrera.

## Hito 30 — consola global y consumo de IA
- Ruta independiente `/platform`, usa Google Login y verifica acceso de operador en el servidor. No exige pertenecer a una academia. La administración de planes se concentra allí; Gestión real conserva solo el resumen del plan propio.
- Indicadores globales de espacios individuales/institucionales, planes efectivos y asignaciones vencidas; no son métricas de ingresos ni clientes pagadores. Listado paginado y búsqueda local entre las academias cargadas; historial paginado por academia con operador, motivo y fecha. No permite acceso al contenido educativo de las academias.
- Presupuestos provisionales de IA: STARTER 10, PRO 30, ACADEMY 100 intentos por día UTC compartidos por Profe SOS, generación de prácticas y materiales. El contador incluye pendientes y fallidos; no mide tokens ni dinero. Con `ACADEMY_SAAS_QUOTAS_ENABLED=false` se mantiene el límite operativo de 10 para todos. El plan no habilita por sí solo un proveedor de IA.
- La reserva de intentos y cambios de plan comparten un bloqueo transaccional por academia; se mantienen los registros anteriores de consumo. Las bajas de plan bloquean nuevas generaciones cuando el uso excede el límite, no eliminan materiales. El borrado de sesiones/usuarios puede eliminar registros de generación por cascada: todavía no es un contador de facturación inmutable.
- Pruebas ampliadas en `saas-plans.test.ts`: autorización de overview/audit, paginación, invariantes de indicadores, intentos concurrentes y downgrade. Cuatro comprobaciones aisladas de dominio pasaron con copia del código en Node 22; compilación monorepo y suite PostgreSQL no confirmadas (sin acceso DNS a GitHub en el entorno local).
- Pendientes: facturación recurrente, control de costes/tokens, registro inmutable de consumo, búsqueda global en servidor, revisión de seguridad y pruebas de navegador/CI. No se activaron cuotas ni proveedores reales.


## Hito 36 — facturación independiente de AcademyOS
- Migración zh_saas_billing_orders: solicitudes de planes PRO/ACADEMY mensuales/anuales, precio COP capturado, vencimiento de solicitud (7 días), estado PENDING/PAID/CANCELLED/REJECTED, referencia de pago globalmente única en el SaaS, periodo de servicio, operador y nota. No es una factura fiscal ni una transacción Wompi.
- ACADEMY_SAAS_BILLING_ENABLED=false por defecto. Precios sin valores por defecto: ACADEMY_PRO_MONTHLY_COP, ACADEMY_PRO_YEARLY_COP, ACADEMY_ACADEMY_MONTHLY_COP y ACADEMY_ACADEMY_YEARLY_COP. Solo precios enteros positivos COP configurados. El preflight exige al menos un precio y operadores si se habilita.
- OWNER verificado solicita/cancela; OWNER/ADMIN verificados consultan historial paginado. Operadores allowlisted verificados revisan y confirman pagos externos de AcademyOS, nunca pagos del comercio de una academia. Mutaciones con sesión y origen autorizado.
- Confirmación requiere importe exacto y referencia externa, y activa/amplía asignación con auditoría en la misma transacción. Lock de plan y referencia más request ID idempotente; solicitudes vencidas no se confirman (requieren conciliación externa). Una solicitud pendiente no vencida por academia. No se envía dinero ni se consulta proveedor.
- Renovación del mismo plan activo comienza al final de la asignación vigente; nuevas asignaciones o vencidas comienzan al confirmar. Meses calendario UTC (1/12), ajustando día al último del mes si no existe. No conserva ancla de fin de mes para futuras renovaciones. Cambiar plan activo diferente queda bloqueado; asignación manual no puede recortar/reemplazar un periodo pagado vigente. Vencimiento usa el mecanismo efectivo STARTER existente; cuotas siguen opt-in. No borra datos al vencer.
- UI SaasBillingPanel para academia y PlatformBillingPanel en consola global. Historial separado de paquetes, sin pagos ni renovación automática; registro de pago no verificado por pasarela. Precios y cobros desactivados hasta decidir política.
- Pruebas añadidas saas-billing.test.ts: calendario, validación, aislamiento, referencia única, concurrencia, renovaciones y protección periodo. CI y validación real pendientes.
- Pendientes: checkout de plataforma con comercio independiente, tokenización/mandatos con consentimiento y cancelación de renovación, cobros recurrentes, reintentos y conciliación, prorrateo/cambio de plan, impuestos/facturación fiscal, devolución y tratamiento de pagos tardíos, recordatorios, métricas reales. Historial no es un ledger inmutable y se elimina en cascada con workspace. El operador puede registrar erróneamente un pago externo; no sustituye verificación bancaria.
