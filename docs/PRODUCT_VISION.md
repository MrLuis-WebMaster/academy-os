# AcademyOS — visión de producto (decisión vigente)

**Un SaaS educativo multi-tenant que sirve desde el día uno tanto a profesores independientes como a pequeñas academias con varios docentes.** No hay un repositorio/app diferente por profesor: hay una sola plataforma compartida, identidades de marca independientes y aislamiento estricto de datos por workspace.

## Experiencia prometida
El profesor entra con Google y crea su academia desde un asistente corto. Elige SOLO o ACADEMY, nombre, materias y luego configura marca, horarios, servicios, metodología y equipo. Sus alumnos ven el nombre y el contenido de esa academia, no un panel genérico. La ruta pública canónica de cada academia es `/academy/:slug/`; el catálogo instalado ofrece nombre, color, icono y manifiesto PWA propios. Dominios totalmente personalizados siguen pendientes de DNS y HTTPS; no se presentan como activos.

### Los cinco módulos conectados

| Módulo | Qué cubre | Estado del código |
|---|---|---|
| **1. Gestión tradicional** | Onboarding, equipo, alumnos, cursos, agenda, asistencia, materiales, prácticas, reservas, notificaciones, cobros y facturación | Operación básica, registro manual de cobros y bonos con canje/devolución y reservas con créditos obligatorios opcionales; no checkout ni facturación real |
| **2. Clase Viva** | Observaciones del docente, borradores de ejercicios con IA, aprobación humana, actividades publicadas | Notas, prácticas, flashcards y microlecciones con borradores/aprobación; generación IA opcional requiere proveedor externo y faltan audio/transcripción |
| **3. Pasaporte** | Competencias respaldadas por evidencias de profesores, objetivos, logros y próximos pasos | Progreso, metas, evidencia humana y recomendaciones deterministas; faltan mapas visuales completos y rúbricas avanzadas |
| **4. Profe Studio** | Marca propia, catálogo de cursos/servicios, identidad PWA y tienda | Marca, catálogo, ofertas y PWA con manifiesto propio; faltan checkout, suscripciones recurrentes y DNS |
| **5. Profe SOS** | Asistente con metodología del profesor, notas aprobadas y dudas escaladas | Configuración por docente, opt-in, limitación de fuentes, derivación manual y respuestas de profesores; pendiente validar IA con proveedor externo |

## Un ciclo de aprendizaje, no cinco islas

1. Una clase queda asociada a academia, curso y profesor.
2. El docente guarda notas en Clase Viva; solo las publicadas se vuelven fuente para alumnado e IA.
3. El docente puede generar un borrador de práctica siguiendo su metodología y aprobarlo.
4. El alumno realiza prácticas; se registran intentos. El profesor registra **evidencia humana** de dominio por tema, por separado de las notas automáticas.
5. Pasaporte agrega evidencia verificada, metas asignadas y próximos objetivos sin inferir etiquetas psicológicas.
6. Profe SOS muestra esos próximos pasos **localmente**, responde con fuentes publicadas tras opt-in, o permite enviar una duda al profesor. Esa duda recibe respuesta en la bandeja privada de la academia.
7. Profesor y administrador consultan indicadores agregados y ajustan próximas clases.

**Prohibido** convertir resultados de IA en evaluaciones certificadas, usar notas privadas de otros alumnos o activar automáticamente proveedores externos.

## Especialidades pedagógicas
Configuraciones por profesor: GENERAL, LANGUAGES, MATHEMATICS, MUSIC, ART_DESIGN, SCHOOL_SUPPORT, EXAM_PREP. Estilos: SOCRATIC, STEP_BY_STEP, CONVERSATIONAL, PRACTICAL, VISUAL. Se conserva la libertad de impartir varias materias, pero las configuraciones no alteran permisos, políticas de privacidad o fuentes autorizadas. Speaking, audio de música, portafolio visual y simulacros completos son módulos especializados futuros, no funcionalidades falsamente marcadas como completas.

## Fases comerciales (no equivalen a hitos técnicos)
- **Fase 1 — comercializable:** gestión diaria real, marca, pagos/paquetes funcionales, materiales, agenda, asistencia, soporte, seguridad y QA completos.
- **Fase 2 — inteligencia educativa:** Clase Viva enriquecida, Pasaporte y Profe SOS con proveedores, cuotas, aprobación humana y privacidad real.
- **Fase 3 — crecimiento:** tienda de recursos/cursos, suscripciones, automatizaciones comerciales, informes familiares seguros y modalidades por especialidad.

## Condiciones no negociables
DDD/hexagonal por contexto, componentes primitivos reutilizables, light/dark/system, PWA mobile-first, servicios reemplazables por puertos, consultas/ediciones con aislamiento y permisos reevaluados, proveedor IA externo explícitamente habilitado, datos de menores tratados solo tras procesos legales verificables. No llamar «producción» a un CI verde.
