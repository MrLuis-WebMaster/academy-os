# AcademyOS — acceso familiar condicionado (sin verificación legal integrada)

## Principio de seguridad
La invitación con rol GUARDIAN **no** permite consultar alumnos automáticamente. Un OWNER o ADMIN de la academia debe registrar un vínculo concreto y dejarlo PENDING. Solo el mismo personal autorizado puede cambiarlo a ACTIVE tras confirmar que hizo la verificación **fuera de AcademyOS**.

No se procesan ni se deben adjuntar documentos de identificación en AcademyOS. La declaración interna es evidencia operativa, **no prueba legal** del parentesco o representación. Para usar la plataforma con menores hace falta integrar los procesos y consentimientos exigidos por la legislación aplicable, y revisar retención, eliminación, notificación de brechas y privacidad.

## API
- POST `/api/v1/workspaces/:workspaceId/invitations` con rol GUARDIAN, según permisos de invitación normales. Aceptar la invitación solo da acceso al workspace, no a estudiantes.
- GET `/api/v1/workspaces/:workspaceId/guardians/links` consulta al personal manager los vínculos del espacio.
- POST `/guardians/links` con `guardianUserId` y `studentUserId`: requiere que ambos usuarios tengan los respectivos roles en la misma academia. Registra estado PENDING.
- PATCH `/guardians/links/:linkId/approve` con `verificationConfirmed:true`, `method:IN_PERSON|OTHER_MANUAL_VERIFICATION` y `verificationNote`. Solo OWNER/ADMIN. Activa acceso tras revalidar roles; audita el evento.
- PATCH `/guardians/links/:linkId/revoke` con motivo: permite a gestores, acudiente o estudiante asociado revocar. Repetir es idempotente. Revocar mantiene el historial; una solicitud posterior vuelve a PENDING y requiere nueva aprobación.
- GET `/guardians/students` devuelve solo alumnos con vínculo ACTIVE y rol STUDENT vigente.
- GET `/guardians/students/:studentId/overview` devuelve nombres de cursos/competencias y estados de metas. La autorización de vínculo ACTIVE se comprueba dentro de la misma transacción protegida por lock de vínculo.

## Información que NO se comparte
Enlaces de clases, recursos privados, respuestas o textos de evidencias, notas completas docentes, correo de otros alumnos, datos de pago y asistencia sin procesar. Los managers sí pueden ver los correos de guardian y estudiante para efectuar el proceso externo de comprobación.

## Pendiente antes del lanzamiento
Identidad/representación verificable, flujos de consentimiento y retirada, política regional de privacidad infantil, retención/exportación/eliminación, pruebas manuales y E2E, documentos legales y revisión por responsables del tratamiento. No se declara apto para uso con menores.
