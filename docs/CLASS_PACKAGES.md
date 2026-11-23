# AcademyOS — Paquetes de clases y créditos manuales

El módulo `Commerce / Class Packages` permite que el personal de la academia configure un catálogo de **créditos de clases**. No equivale a un checkout, una orden procesada, una factura ni una conciliación de ingresos. La propiedad `priceCOP` es **informativa**, y el administrador debe comprobar cualquier pago fuera de AcademyOS antes de otorgar créditos. La plataforma mantiene los cursos existentes gratuitos por defecto. En un curso configurado explícitamente como «requiere paquete», cada nueva reserva **debe consumir un crédito válido dentro de la misma transacción**; si no hay saldo, la reserva no se crea. Los créditos también pueden aplicarse manualmente a reservas de cursos gratuitos. Esta protección cubre reservas, no el checkout ni necesariamente el acceso a todos los materiales.

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

\`courseId\` es opcional: cuando está definido, el alumno debe estar matriculado en ese curso para recibir y usar el paquete; cuando es nulo **al crear un paquete general**, vale para cualquier clase reservable. Se conserva un indicador inmutable de restricción al curso: si se elimina posteriormente el curso vinculado, el paquete **no se transforma en universal** y no permite nuevas emisiones o canjes de ese curso eliminado.

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

## Política opcional de clases con crédito obligatorio
`PATCH /api/v1/workspaces/:workspaceId/courses/:courseId/package-policy` con `{"requiresPackage":true}` o `false`. Solo OWNER/ADMIN de la academia. Un curso se crea con `requiresPackage=false` y la política se expone en el listado de cursos y el aula del alumno.

Al activar la política, una comprobación bloqueada por curso verifica que no haya reservas futuras confirmadas sin consumo vigente. Si existe alguna, la activación es rechazada y se deben regularizar/cancelar esas reservas. El mismo bloqueo de política es adquirido por la reserva individual y por la reserva semanal para impedir activaciones en carrera con nuevas reservas.

Al reservar una clase de un curso con paquete obligatorio, se verifica nuevamente la matrícula, la membresía estudiantil y las restricciones de cada bono. La aplicación automática consume un crédito bajo un bloqueo de asignación compartido con el endpoint de canje manual. Las asignaciones se examinan por vencimiento; las de curso restringido no se aceptan para otros cursos. En una serie semanal, **todos** los créditos necesarios se consumen o **ninguna** reserva se confirma. Las cancelaciones siguen devolviendo los créditos transaccionalmente.

Desactivar el requisito permite nuevas reservas gratuitas; no implica devolver automáticamente créditos ya gastados por clases existentes ni devolver dinero. Cualquier cambio de modelo financiero deberá revisarse con los alumnos.

## Historial administrativo y revocación segura
`GET /api/v1/workspaces/:workspaceId/packages/issuances` devuelve a OWNER/ADMIN las **últimas 200** asignaciones de créditos de su academia, con nombre del alumno y emisor, paquete, créditos consumidos, créditos realmente utilizables, fecha de vencimiento, reservas futuras cubiertas y datos de revocación. El endpoint vuelve a comprobar los permisos dentro de PostgreSQL, sin exponer registros de otras academias.

`PATCH /api/v1/workspaces/:workspaceId/packages/entitlements/:entitlementId/revoke`:

```json
{"reason":"Corrección administrativa autorizada"}
```

La revocación registra fecha, usuario responsable y razón (6–300 caracteres) y notifica internamente al alumno. No afecta reservas ya realizadas: si el bono aún respalda reservas futuras confirmadas, **rechaza la revocación** hasta que esas reservas hayan sido canceladas y los créditos devueltos. El bloqueo de asignación está compartido con el débito automático/manual de créditos, de forma que la acción no puede adelantarse a un canje concurrente. Reintentar la misma revocación no cambia el motivo original ni duplica notificaciones. Es una operación administrativa de créditos, **no reembolsa dinero**.

## Uso del alumno

`GET /api/v1/workspaces/:workspaceId/packages/mine` lista únicamente las asignaciones del alumno autenticado, sus créditos totales, usados, no consumidos (\`remaining\`), actualmente aplicables (\`available\`), vencimiento y `activeBookingIds\`. Los créditos vencidos pueden seguir sin consumir, pero su cantidad aplicable es cero. No muestra transacciones ni asignaciones de otros alumnos.

`POST /api/v1/workspaces/:workspaceId/packages/redeem`:

```json
{"entitlementId":"id-del-bono","bookingId":"id-de-reserva-propia"}
```

Solo puede aplicarse a una **reserva propia, confirmada y futura**, con matrícula aún vigente, del curso cubierto por el paquete, si el saldo es positivo y el bono no ha vencido ni sido revocado. La operación verifica permisos y restricciones en PostgreSQL dentro de una transacción. Un bloqueo por reserva seguido de otro por asignación impide que dos canjes concurrentes consuman el último crédito. Los reintentos sobre la misma reserva y paquete son idempotentes.

Cuando el alumno cancela una reserva individual, cancela una serie futura, o el docente cancela una clase individual o una serie futura, los créditos se **devuelven dentro de la misma transacción** que cambia el estado. El sistema no reembolsa dinero: únicamente libera un crédito de clase. Cancelar una serie del profesor no altera reservas históricas.

## Pendientes
- [Resuelto para reservas] Exigir un crédito asignado manualmente cuando el curso requiere paquete. **Pendiente**: ligarlo a confirmación bancaria/pasarela real, matrícula pagada y contenido premium protegido.
- Integración de pasarela (orden, webhook firmado, confirmación, conciliación), comprobantes legales y reembolsos de dinero.
- Adquisición autoservicio y renovaciones recurrentes de membresías.
- Política para alumnos que dejan de estar matriculados, modificaciones posteriores de planes, exportación paginada y conciliación contable externa de emisiones y revocaciones.
- QA E2E de interfaz en staging e informe auditable de emisiones y consumos.

Las pruebas automatizadas cubren integridad del crédito, concurrencia, duplicados, permisos multi-tenant, cancelación y conservación de los derechos existentes. CI no es certificación contable.
