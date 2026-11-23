# AcademyOS — metodología, perfil y dudas docentes

## Metodología por profesor
`GET /api/v1/workspaces/:workspaceId/teaching-methods/:teacherProfileId` y `PUT` con `specialty`, `style`, `language`, `guidance` (0–1200 caracteres), `sosEnabled`. Un OWNER/ADMIN gestiona docentes de su workspace; el TEACHER solo su propio perfil. De forma predeterminada Profe SOS está **deshabilitado** para cada profesor.

Las sugerencias de Clase Viva reciben metodología del profesor asignado a la sesión, como contexto no privilegiado, y se guardan como borradores. Profe SOS usa una metodología habilitada de un docente asignado al curso. No puede responder si ningún docente de ese curso habilitó el asistente. Aunque esté habilitado, falta activar un proveedor de IA real y cada estudiante debe aprobar expresamente el envío de su pregunta y fuentes de clase publicadas.

Las instrucciones personalizadas son datos del docente, no instrucciones del sistema: el proveedor debe obedecer siempre límites de privacidad, fuentes aprobadas y comportamiento de tutor de acompañamiento.

## Dudas al docente sin proveedor de IA
`POST /api/v1/workspaces/:workspaceId/profe-sos/referrals`: `{"courseId":"...","question":"..."}`. Solo un STUDENT matriculado puede enviar. No se usa proveedor de IA, no se transcribe conversación y se eliminan emails/teléfonos detectables de forma best-effort. Máximo tres dudas abiertas por curso/alumno. Las preguntas quedan en el workspace, con aviso interno a los docentes actualmente asignados.

`GET /profe-sos/referrals/mine` devuelve preguntas propias de cursos con matrícula. `GET /profe-sos/referrals/staff` devuelve solo preguntas de cursos asignados al profesor, o todas las del espacio para OWNER/ADMIN. `PATCH /profe-sos/referrals/:referralId/resolve` registra respuesta final del docente y envía aviso interno al estudiante. Los reintentos no sobreescriben respuestas ni duplican notificaciones.

No se envía contenido por email ni WhatsApp. El alumno escoge explícitamente cuándo enviar una pregunta; una respuesta IA que sugiere derivación no abre automáticamente una pregunta.

## Perfil de aprendizaje basado en evidencias
`GET /api/v1/workspaces/:workspaceId/learning-progress/student/profile` solo muestra datos del alumno autenticado, filtrados a sus matrículas. El resultado agrega competencias evaluadas por docentes, número de evidencias, metas activas/alcanzadas y hasta seis siguientes pasos por prioridad: meta con dominio verificado por debajo del porcentaje objetivo, meta sin evidencia registrada o meta activa pendiente.

Las metas alcanzadas generan una lista de logros confirmados por profesores. No se generan diagnósticos psicológicos, niveles inferidos de inteligencia ni estilos personales. El Pasaporte muestra los próximos pasos; Profe SOS puede mostrarlos localmente como contexto visible para el alumno **sin enviarlos a proveedores externos**.

## PWA por academia
`/academy/:slug/` sirve como ruta de lanzamiento de una academia publicada. Cada catálogo tiene manifiesto `GET /api/v1/studio/public/:slug/manifest.webmanifest` con id, nombre, color, ruta y alcance propios, más un icono SVG generado en nuestro backend usando iniciales y color. Los recursos se devuelven solo cuando el catálogo está publicado. La versión anterior por `/?academy=:slug` sigue disponible.

No se han configurado dominios distintos, certificados TLS reales por cliente, iconos PNG/Apple touch optimizados, pruebas de instalación en iOS/Android ni funcionalidades offline privadas. Debe validarse el comportamiento real de «Añadir a pantalla de inicio» antes de anunciarlo como independiente.

## Alertas de refuerzo en grupos
`GET /api/v1/workspaces/:workspaceId/learning-progress/courses/:courseId/insights` está restringido a OWNER/ADMIN y docentes asignados al curso. Reutiliza la misma lectura autorizada de temas, alumnos, metas y competencias humanas que utiliza la gestión del Pasaporte.

La lógica muestra una oportunidad de refuerzo solo si **al menos dos** estudiantes tienen una meta vigente vinculada a un tema y una valoración humana inferior al objetivo definido. El mismo estudiante cuenta una sola vez aunque tenga varias metas. Si existen al menos dos metas sin evidencias docentes, se propone **evaluar antes de interpretar dificultad**. No se crean notas ni actividades sin aprobación del profesor. El panel permite seleccionar el tema de trabajo y continuar con Clase Viva.

Esto implementa la base comprobable del caso «tres alumnos necesitan refuerzo sobre pasado simple». No genera todavía microlecciones ni envía alertas push/email.
