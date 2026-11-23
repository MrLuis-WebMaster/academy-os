# AcademyOS — competencias y metas de aprendizaje

## Evidencia humana
El docente asignado al curso, OWNER o ADMIN puede registrar una evaluación de una competencia existente. Endpoint: `POST /api/v1/workspaces/:workspaceId/learning-progress/evidence`.

Ejemplo: `{"topicId":"...","studentUserId":"...","requestId":"UUID","score":90,"note":"Resolvió el ejercicio sin ayuda y explicó los pasos."}`.

Se comprueba que el tema corresponda al curso de la academia, que el alumno tenga rol STUDENT y matrícula activa y que el evaluador esté asignado a ese curso (salvo OWNER/ADMIN). El `requestId` permite reintentos idempotentes; reutilizarlo con otros datos genera conflicto. La evidencia nunca se sobrescribe. La valoración `SkillProgress.mastery` expresa el promedio (0–100) de las evidencias revisadas por docentes, no una inferencia de dominio general ni una evaluación de IA.

`GET /learning-progress/evidence?topicId=...&studentUserId=...` permite consultar la historia de evaluaciones a personal autorizado.

## Metas
`POST /learning-progress/goals` recibe `courseId`, `studentUserId`, `title` y opcionalmente `topicId`, `description`, `targetMastery` (1–100) y `targetAt` (ISO con offset). Máximo 20 metas activas por curso y estudiante. La creación y los cambios se hacen bajo locks transaccionales.

`PATCH /learning-progress/goals/:goalId/status` acepta `{"status":"ACHIEVED","reason":"Comprobado en clase"}` o CANCELLED. Una meta terminada no vuelve a ACTIVE: se registra el motivo y el cambio en LearningGoalEvent. Nunca se marca como alcanzada automáticamente por IA.

## Consultas y frontend
`GET /learning-progress/student`: devuelve al alumno sus competencias y metas en cursos con matrícula. `GET /learning-progress/courses/:courseId` permite al OWNER/ADMIN y docentes asignados consultar una lista acotada de estudiantes, temas y progreso; no se devuelven direcciones de correo en esta proyección.

Los paneles Gestión real y Mi Pasaporte consumen estas rutas. El Pasaporte conserva por separado los promedios automáticos de prácticas y las competencias humanas para no confundir ambas métricas.

## Limitaciones
La primera versión agrega las calificaciones de cada evidencia con igual peso; no hay aún rúbricas múltiples, reemplazo por corrección auditada, recomendaciones automáticas ni certificación formal. Cualquier uso con menores está sujeto a las garantías pendientes indicadas en RELEASE_CHECKLIST.md.
