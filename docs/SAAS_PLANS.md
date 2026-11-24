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
