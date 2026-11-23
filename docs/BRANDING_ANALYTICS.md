# AcademyOS — Branding y analítica institucional

## Marca pública
Profe Studio permite actualizar una academia con `PATCH /api/v1/studio/workspaces/:workspaceId` y un objeto que incluya opcionalmente `brandColor` en HEX (por ejemplo `"#7059e8"`) y `logoUrl` HTTPS opcional. El campo `logoUrl` puede vaciarse o establecerse a null; el logo es una imagen externa que el navegador carga desde la URL dada. Los datos se exponen en `GET /api/v1/studio/public/:slug` **solo** cuando `publicEnabled` es true.

La pantalla del editor muestra vista previa y el catálogo usa logo, nombre y color. La configuración no verifica que la academia posea el dominio del logo, no almacena imágenes y no habilita dominios vanity. En staging debe evaluarse CSP, visibilidad de datos de visitantes por terceros y tratamiento de enlaces.

## KPIs internos
`GET /api/v1/workspaces/:workspaceId/analytics/overview?period=7d|30d|90d`. Solo OWNER y ADMIN; el repositorio también verifica el rol y el filtro workspace antes de consultar PostgreSQL.

- Alumnos, docentes y cursos: **totales actuales**, no solo del período.
- Clases: número de CONFIRMED, COMPLETED y CANCELLED cuyos inicios corresponden al período.
- Reservas: registros BOOKED de clases del período; no estudiantes únicos.
- Asistencia: reservas con estado de asistencia registrado de clases del período.
- Prácticas: intentos registrados y puntuación media de los intentos en el período; no equivalente al dominio certificado.
- Evidencias revisadas: cantidad de evaluaciones humanas del período.
- Metas activas: total actual de objetivos ACTIVE.
- Finanzas: suma de recibos manuales no anulados cuya fecha de recepción está en el período, en COP. No es cifra de pagos por pasarela ni conciliación contable; se muestra separada de comprobantes anulados durante el período.

La visualización es agregada y no expone nombres o emails de alumnos. No hay dashboards históricos agregados por día/semana, exportación, pronóstico ni herramientas de inteligencia empresarial aún.
