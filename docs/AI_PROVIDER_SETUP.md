# AcademyOS — configurar IA de forma segura

**Estado:** implementación opcional lista en código y probada con adaptadores falsos; **NO verificada aún contra OpenAI ni disponible para usuarios reales.**

## 1. Requisitos

AcademyOS necesita el servidor/API y PostgreSQL configurados; Google login necesita su propio OAuth. Para habilitar IA se necesita un proyecto con facturación y acceso a los modelos usados en la API.

Variables solo en el servidor:

```dotenv
ACADEMY_AI_ENABLED=false
ACADEMY_AI_MODEL=gpt-5-mini
OPENAI_API_KEY=
```

Configurar la clave real exclusivamente en secretos del hosting. **Nunca** en el repositorio, frontend ni Vite. Cambiar a `ACADEMY_AI_ENABLED=true` solo después de probar reglas de permisos y privacidad.

## 2. Qué hace Clase Viva con IA

El docente guarda notas, revisa que no incluyan información personal, selecciona la clase y autoriza explícitamente enviarlas a un proveedor externo. El servidor limita el texto, suprime correos/teléfonos mediante reglas de minimización y solicita entre dos y cuatro preguntas mediante **Structured Outputs**. Los resultados se guardan con `publishedAt=null`. La pantalla muestra las preguntas, opciones, soluciones y explicaciones para que el docente pueda editarlas. Nada llega al estudiante hasta su publicación manual.

La minimización automática de contactos **no** garantiza anonimización completa. Los profesores deben revisar las notas antes de consentir su envío.

## 3. Profe SOS

Solo estudiantes matriculados pueden consultar el asistente. El servidor recupera exclusivamente **hasta seis notas publicadas del curso**, valida que las citas correspondan a esas notas y deriva al profesor si no hay evidencia. No lee Google Drive u otras carpetas privadas. No hay historial de chat persistente. La pregunta y notas aprobadas se transmiten al proveedor solo tras aceptación explícita.

## 4. Límites y política de costes

Hasta 10 solicitudes totales de Clase Viva + Profe SOS por academia y por día UTC, contadas antes de llamar al proveedor. El modelo y `max_output_tokens` son configurables/limitados. **No hay un límite garantizado de dólares:** configurar presupuestos y alertas en el proveedor.

## 5. Verificación antes de activar

- [ ] Probar el flujo con clave real y facturación activa.
- [ ] Comprobar fallos, refusals, respuestas incompletas y límites de uso.
- [ ] Verificar permisos multi-tenant para docentes y estudiantes.
- [ ] Confirmar consentimiento, tratamiento de datos personales y restricciones de menores.
- [ ] Registrar métricas anonimizadas de consumo y errores, sin prompts de alumnos.
- [ ] Confirmar las condiciones de retención, ubicación de datos y privacidad del proveedor.
- [ ] Probar publicación y edición de un borrador generado, y que un estudiante no reciba la solución hasta ser evaluado.

Documentación oficial:
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/pricing
