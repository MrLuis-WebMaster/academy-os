# AcademyOS — estado real y bloqueadores (2026-11-23)

## Implementado en el repositorio
- Monorepo, Design System, PWA, CI, PostgreSQL y arquitectura por contextos.
- Better Auth/Google configurables; onboarding OWNER idempotente e invitaciones seguras.
- Academics: materias, cursos, matrículas, docentes, temarios y permisos por curso.
- Scheduling: clases híbridas/virtuales/presenciales, reservas, series, disponibilidad, ausencias, reprogramación, cancelación y asistencia.
- Classroom y Learning: materiales, Clase Viva, prácticas, tres intentos máximos concurrentes y Pasaporte inicial.
- IA opt-in en código, bandeja interna, ICS privado y finanzas manuales.
- Profe Studio con servicios, catálogo público opt-in y gestión por academia.
- Staging Docker/Caddy con HTTPS y scripts de respaldo/restauración (NO desplegado).

## Bloqueadores P0 para un piloto con usuarios reales
1. Desplegar staging en HTTPS, configurar Better Auth y Google OAuth con credenciales reales y probar inicio/cierre de sesión, onboarding e invitaciones.
2. Verificar restauración de PostgreSQL, backup programado y cifrado fuera del servidor, métricas, alertas y políticas de recuperación.
3. Ejecutar E2E y pruebas IDOR sobre todos los roles y rutas, accesibilidad y UX móvil, políticas de privacidad, retención y consentimiento para menores.
4. Revisar los enlaces externos de recursos y clases: HTTPS no implica permisos de acceso ni protección de archivos.

## Bloqueadores P1/P2 para lanzamiento comercial avanzado
- Elegir y conectar pasarela de pagos; firmar webhooks, implementar reembolsos, conciliación e impuestos.
- Configurar correo, push o WhatsApp con consentimiento, colas y recordatorios programados.
- OAuth de Calendar/Meet, Zoom y Drive, revocación, refresco y permisos separados del login.
- Probar IA con proveedor real y política de minimización de datos; resúmenes IA pendientes.
- Acudientes, sedes/aulas, feriados automáticos, edición masiva de series, dominios/white-label, multimoneda y analítica avanzada.

## Declaración de alcance
CI verde valida código y pruebas automatizadas, no demuestra operación real de OAuth, pagos, emails o hosting. No anunciar AcademyOS como terminado hasta pasar el checklist de lanzamiento.

Consultar también STAGING_DEPLOYMENT.md, SECURITY.md, ROADMAP.md y RELEASE_CHECKLIST.md.