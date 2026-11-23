# AcademyOS — estado real y bloqueadores (2026-11-23)

## Implementado en el repositorio
- Monorepo, Design System, PWA, CI, PostgreSQL y arquitectura por contextos.
- Better Auth/Google configurables; onboarding OWNER idempotente e invitaciones seguras.
- Academics: materias, cursos, matrículas, docentes, temarios y permisos por curso.
- Scheduling: clases híbridas/virtuales/presenciales, reservas individuales y recurrentes, edición masiva de series, disponibilidad, ausencias, feriados nacionales de Colombia opcionales, sedes y aulas con disponibilidad física, reprogramación, cancelación y asistencia.
- Classroom y Learning: materiales, Clase Viva, prácticas, tres intentos máximos concurrentes, Pasaporte, evidencias docentes por competencia y metas auditadas.
- IA opt-in en código, bandeja interna, preferencias de recordatorios 24h/1h y worker in-app desactivado hasta configurar hosting, ICS privado y finanzas manuales.
- Profe Studio con servicios, catálogo público opt-in, color/logo de marca HTTPS, y gestión por academia. Dashboard de métricas agregadas por período, sin filas personales.
- Staging Docker/Caddy con HTTPS y scripts de respaldo/restauración (NO desplegado).

## Bloqueadores P0 para un piloto con usuarios reales
1. Desplegar staging en HTTPS, configurar Better Auth y Google OAuth con credenciales reales y probar inicio/cierre de sesión, onboarding e invitaciones.
2. Verificar restauración de PostgreSQL, backup programado y cifrado fuera del servidor, métricas, alertas y políticas de recuperación.
3. Ejecutar E2E y pruebas IDOR sobre todos los roles y rutas, accesibilidad y UX móvil, políticas de privacidad, retención y consentimiento para menores.
4. Revisar los enlaces externos de recursos y clases: HTTPS no implica permisos de acceso ni protección de archivos.

## Bloqueadores P1/P2 para lanzamiento comercial avanzado
- Elegir y conectar pasarela de pagos; firmar webhooks, implementar reembolsos, conciliación e impuestos.
- Activar y supervisar recordatorios internos en servidor; correo, push o WhatsApp con consentimientos independientes, outbox externo y reintentos.
- OAuth de Calendar/Meet, Zoom y Drive, revocación, refresco y permisos separados del login.
- Probar IA con proveedor real y política de minimización de datos; resúmenes IA pendientes.
- Verificación legal y consentimiento de acudientes (el portal familiar y aprobación manual de vínculos ya existen en código), suplencias, feriados internacionales/regionales, dominios personalizados/white-label completo, multimoneda y analítica avanzada.

## Declaración de alcance
CI verde valida código y pruebas automatizadas, no demuestra operación real de OAuth, pagos, emails o hosting. No anunciar AcademyOS como terminado hasta pasar el checklist de lanzamiento.

Consultar también STAGING_DEPLOYMENT.md, SECURITY.md, ROADMAP.md y RELEASE_CHECKLIST.md.
## Conexión de producto y academia propia (2026-11-23)
- Metodología por profesor y asistentes especializados en estilo/idioma, con activación de SOS independiente.
- Dudas directas al profesor y respuestas internas, protegidas por curso y matrícula.
- Perfil educativo privado y objetivos siguientes basados solo en evaluación humana y metas.
- Identidad instalable de catálogo para academias publicadas mediante ruta y manifiesto PWA por slug; todavía sin DNS propio ni prueba de instalación real.
- Prioridad de entrega siguiente: paquetes/membresías, cobro real con autorización externa, Clase Viva audio/flashcards, políticas de protección de menores y QA.
