# AcademyOS — Implementation status (2026-11-22)

## Entregas codificadas en `main`
- Login Better Auth + Google: flujo implementado, necesita credenciales OAuth, base real y validación E2E; registro de propietario mediante onboarding de tres pasos.
- Persistencia Prisma/PostgreSQL con migraciones `0_init` a `6_manual_payments`, guards de sesiones y permisos tenant.
- Profesores, alumnos, cursos, materias, asignación de profesores, temas y matrículas.
- Clases virtuales/presenciales/híbridas, enlaces manuales, detección básica de choques, cancelaciones, reserva de cupos transaccional y asistencia.
- Aula Digital protegida para inscripciones y publicaciones de materiales HTTPS.
- Clase Viva de anotaciones aprobadas, cuestionarios manuales con corrección e historial de intentos; Pasaporte de resultados basados en evidencia.
- Profe Studio básico (página pública solo tras habilitarla) y catálogo de servicios.
- Finanzas manuales con recibos y anulaciones; no es una pasarela real.
- PWA con precaché de activos públicos y pantalla offline; nada privado se guarda en caché.
- CI: Prisma validate/generate/migrate + tests + build + smoke checks; prueba nueva de aislamiento y concurrencia añadida (última ejecución pendiente de confirmación).

## Límites no resueltos
- OAuth Google en entorno real, test del callback, cookies, sesiones y logout end-to-end.
- Meet/Zoom/Drive, correo transaccional, sync calendario, app almacenamiento no conectado.
- Clase Viva IA y Profe SOS no implementados; ejercicios actuales son del profesor.
- Checkout, cobros reales, facturación y reembolsos no implementados.
- Dedicado bootstrap OWNER, acudientes, recuperación de cuenta, consentimientos para menores y grabaciones.
- Auditoría/observabilidad/backup, publicación por dominios y pruebas de seguridad profundas.
- El dashboard original sigue siendo una demo; la pantalla **Gestión real** contiene los flujos persistentes.
- El código no está desplegado como servicio para clientes.

## Estado de integraciones
Credenciales privadas necesarias en el entorno, nunca en GitHub. Ver `GOOGLE_LOGIN_SETUP.md`, `INTEGRATIONS.md` y `RELEASE_CHECKLIST.md`. La visibilidad actual del repositorio es pública.

## QA local
```bash
pnpm install
docker compose up -d
pnpm db:validate
pnpm db:generate
pnpm --filter @academy-os/api exec prisma migrate deploy
pnpm typecheck && pnpm test && pnpm build
```
