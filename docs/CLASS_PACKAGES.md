# AcademyOS — Paquetes de clases y créditos manuales

El módulo `Commerce / Class Packages` permite que el personal de la academia configure un catálogo de **créditos de clases**. No equivale a un checkout, una orden procesada, una factura ni una conciliación de ingresos. La propiedad `priceCOP` es **informativa**, y el administrador debe comprobar cualquier pago fuera de AcademyOS antes de otorgar créditos. La plataforma aún permite reservar clases sin paquete; los créditos se aplican a reservas existentes, no constituyen una restricción de acceso a clases de pago.

## Gestión del administrador

`GET /api/v1/workspaces/:workspaceId/packages` lista los paquetes creados (OWNER/ADMIN).

`POST /api/v1/workspaces/:workspaceId/packages` crea uno:

```json
{
  "title": "4 clases de conversación",
  "courseId": null,
  "sessionCredits": 4,
  "priceCOP": 160000,
  "validDays": 30
}
```

`courseId` es opcional: cuando está definido, el alumno debe estar matriculado en ese curso para recibir y usar el paquete; cuando es nulo, vale para cualquier clase que el alumno pueda reservar.

`PATCH /api/v1/workspaces/:workspaceId/packages/:packageId/active` con `{"active":false}` detiene **nuevas asignaciones** sin eliminar créditos ya otorgados.

`POST /api/v1/workspaces/:workspaceId/packages/:packageId/issue` crea una asignación manual a un estudiante del espacio:

```json
{
  "studentUserId": "id-del-alumno",
  "requestId": "5c58a842-ea99-4e98-a716-d11df9927585",
  "note": "Pago revisado fuera del sistema"
}
```

La operación es transaccional y `requestId` (UUID) evita emisiones duplicadas por reintentos. Los créditos, la vigencia calculada desde la emisión y el precio de referencia son persistentes. El alumno recibe una notificación **dentro de AcademyOS**, no un correo.

## Uso del alumno

`GET /api/v1/workspaces/:workspaceId/packages/mine` lista únicamente las asignaciones del alumno autenticado, sus créditos totales, usados, disponibles, vencimiento y `activeBookingIds`. No muestra transacciones ni asignaciones de otros alumnos.

`POST /api/v1/workspaces/:workspaceId/packages/redeem`:

```json
{"entitlementId":"id-del-bono","bookingId":"id-de-reserva-propia"}
```

Solo puede aplicarse a una **reserva propia, confirmada y futura**, del curso cubierto por el paquete, si el saldo es positivo y el bono no ha vencido ni sido revocado. La operación verifica permisos y restricciones en PostgreSQL dentro de una transacción. Un bloqueo por reserva seguido de otro por asignación impide que dos canjes concurrentes consuman el último crédito. Los reintentos sobre la misma reserva y paquete son idempotentes.

Cuando el alumno cancela una reserva individual, cancela una serie futura, o el docente cancela una clase individual o una serie futura, los créditos se **devuelven dentro de la misma transacción** que cambia el estado. El sistema no reembolsa dinero: únicamente libera un crédito de clase. Cancelar una serie del profesor no altera reservas históricas.

## Pendientes
- Bloquear reservas de clases que requieren pago hasta confirmar un derecho de acceso real.
- Integración de pasarela (orden, webhook firmado, confirmación, conciliación), comprobantes legales y reembolsos de dinero.
- Adquisición autoservicio y renovaciones recurrentes de membresías.
- Política para alumnos que dejan de estar matriculados, modificaciones posteriores de planes y revocación de créditos con historial contable.
- QA E2E de interfaz en staging e informe auditable de emisiones y consumos.

Las pruebas automatizadas cubren integridad del crédito, concurrencia, duplicados, permisos multi-tenant, cancelación y conservación de los derechos existentes. CI no es certificación contable.
