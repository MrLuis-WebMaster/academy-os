# AcademyOS — agenda avanzada

## Reservas recurrentes de alumnos
POST /api/v1/workspaces/:workspaceId/bookings/series, con `{"seriesId":"..."}`, reserva atómicamente todas las sesiones futuras y confirmadas de la misma serie y curso. La operación valida matrícula, aforo, permisos y series de la misma academia. Los cupos ya reservados son idempotentes; si alguno de los restantes está agotado, no se confirma ninguna nueva reserva.

PATCH /api/v1/workspaces/:workspaceId/bookings/series/:seriesId/cancel-future cancela solo las reservas del alumno autenticado en clases futuras confirmadas. El historial y el progreso permanecen intactos.

## Edición masiva de series
PATCH /api/v1/workspaces/:workspaceId/sessions/weekly-series/:seriesId/future recibe `reason` y al menos una modificación entre `title`, `capacity`, `mode`, `location`, `meetingUrl`, `roomId`, `startsAt` y `endsAt`. Las fechas deben venir juntas con offset ISO 8601.

Solo se editan clases futuras confirmadas. La lógica conserva la hora local semanal ante cambios DST, valida disponibilidad docente, ausencias, festivos opt-in, aulas y aforo mínimo. Cuando varía el horario, crea SessionChange y notificaciones in-app transaccionalmente.

## Festivos
GET /api/v1/workspaces/:workspaceId/scheduling/holidays?year=2027 lista los feriados del calendario elegido. GET/PATCH /scheduling/holiday-settings administra `holidayCountry` (CO o NONE) y `avoidPublicHolidays`. Por defecto la restricción está desactivada. La selección actual implementa únicamente festivos nacionales de Colombia; no cubre departamentales.

Fuentes legales: Ley 51 de 1983 (https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4954) y Ley 2578 de 2026 (https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=193309). Se calculan fechas fijas, Semana Santa, traslados al lunes y el nuevo 9 de julio trasladable desde 2026.

## Sedes y aulas
GET/POST /api/v1/workspaces/:workspaceId/locations/campuses; PATCH /locations/campuses/:campusId; POST /locations/campuses/:campusId/rooms; PATCH /locations/rooms/:roomId.

Solo OWNER/ADMIN crean y modifican sedes/aulas; profesores pueden consultarlas. Una aula física tiene capacidad máxima, pertenece a una academia y no puede reservarse para dos clases confirmadas simultáneas. No se desactivan aulas/sedes utilizadas por clases futuras. ONLINE nunca acepta `roomId`; ONSITE/HYBRID pueden vincular una sala o dirección manual.

## Fuera del alcance probado
La hora de los formularios web se construye actualmente en la zona horaria del dispositivo. La programación global, OAuth, calendarios externos, pagos, festivos de otros países y validación manual con usuarios reales siguen pendientes.
