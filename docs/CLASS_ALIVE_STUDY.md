# AcademyOS — Tarjetas de estudio y microlecciones

## Experiencia de docente
Los profesores crean recursos desde Clase Viva seleccionando una **clase asociada a un curso** que ya tenga observaciones. Solo docentes asignados, propietarios o administradores pueden trabajar sobre estos recursos.

Los formatos son:
- **FLASHCARDS**: entre 2 y 30 tarjetas con frente y respuesta, con longitudes validadas; se guardan como borrador y pueden editarse.
- **MICROLESSON**: explicación corta, entre 1 y 8 pasos con encabezados y contenido, y una pregunta de repaso opcional.

`POST /api/v1/workspaces/:workspaceId/learning-assets` con `sessionId`, `kind`, `title` y `content`. `GET .../learning-assets/staff` devuelve recursos de la academia (o de clases asignadas a un docente no administrador). `PATCH .../learning-assets/:assetId` permite revisar **solo borradores**; `POST .../learning-assets/:assetId/publish` permite publicar **solamente cuando las notas de la clase vinculada ya estén publicadas**. La edición y publicación usan bloqueos transaccionales compartidos por recurso.

## IA opcional
`POST /api/v1/workspaces/:workspaceId/class-alive/sessions/:sessionId/suggest-asset` con:

```json
{"kind":"FLASHCARDS","approveExternalProcessing":true}
```

También acepta `MICROLESSON`. La IA propone un borrador, **no lo publica**. Solo procesa notas del docente, minimizadas con un filtro básico de correos y teléfonos, y la metodología de ese profesor. El docente debe revisar y aprobar las fuentes y la corrección de cada explicación. El presupuesto de IA es compartido con el asistente de prácticas y Profe SOS por academia (10 intentos/día registrados).

No funciona sin `ACADEMY_AI_ENABLED=true` y un proveedor externo configurado en secretos. El procesamiento real, la privacidad del proveedor y la calidad del contenido generado siguen **sin verificación con credenciales reales**.

## Experiencia del alumno
`GET /api/v1/workspaces/:workspaceId/learning-assets/student` devuelve únicamente recursos:
1. cuyo recurso tenga `publishedAt`;
2. cuya reflexión esté en `PUBLISHED`;
3. cuya clase y curso pertenezcan a la academia solicitada; y
4. en cuyo curso esté actualmente matriculado el alumno.

Las tarjetas se pueden girar, avanzar y marcar como «la recuerdo»/«repasar» dentro de la sesión de navegador. Esta autoevaluación no se registra como evidencia humana ni modifica la maestría del Pasaporte.

Las microlecciones muestran una explicación y pasos breves, con una pregunta de revisión cuando exista. Se requiere revisión manual de accesibilidad y aprendizaje en móvil/PC, así como política de privacidad/retención antes del lanzamiento.

## Pendientes
- Subir y almacenar audio, transcripción y edición segura de notas por voz.
- Material interactivo de speaking, pronunciación, simulacros, música y portafolios visuales.
- Progreso persistente de repaso espaciado, si se implementa con consentimiento, sin mezclarlo con competencias certificadas.
- Tests E2E de publicación, cambio de academia, PWA, IA real y límites de tamaño por proveedor.
