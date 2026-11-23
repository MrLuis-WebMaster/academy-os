# AcademyOS — staging reproducible (NO producción)

Se añadió una plantilla Docker Compose con NestJS, Vite compilado, PostgreSQL 19 y Caddy HTTPS. **La existencia de estos archivos no implica que haya un servidor desplegado**. El operador debe proporcionar dominio, DNS, credenciales, respaldo y revisar seguridad antes de usar datos reales.

## Requisitos
- Servidor con Docker Engine y Compose; DNS A/AAAA para `STAGING_DOMAIN`, puertos 80/443 accesibles o adaptación a un reverse proxy existente.
- Cuenta Google Cloud con credenciales OAuth y URL de callback autorizada. Revisar `GOOGLE_LOGIN_SETUP.md`.
- Contraseña de base y `BETTER_AUTH_SECRET` aleatorios, generados fuera del repositorio; nunca compartirlos ni imprimirlos en CI.
- Staging con datos **ficticios**, nunca producción ni alumnos reales antes de cumplir `RELEASE_CHECKLIST.md`.

## Configuración manual

1. Copiar `deploy/staging/.env.staging.example` a `.env.staging` en el servidor (archivo ignorado por Git). Sustituir todos los marcadores. Configurar `STAGING_DATABASE_URL` usando host `postgres`, base `academy_os` y codificar la contraseña en URL.
2. Configurar la pantalla de consentimiento de Google y el callback `https://TU_DOMINIO/api/auth/callback/google` (ver documentación de Better Auth); el mismo dominio es `WEB_ORIGIN` y `BETTER_AUTH_URL`.
3. Iniciar: `docker compose --env-file .env.staging -f compose.staging.yaml up -d --build`. La API aplica `prisma migrate deploy` antes de escuchar; el sitio se sirve mediante Caddy.
4. Verificar `https://TU_DOMINIO/api/v1/health`, `/api/v1/auth-config`, la autenticación Google, el onboarding y la separación entre academias. El smoke test de CI no valida OAuth real.
5. Hacer backup y probar recuperación **sin información de clientes** antes del piloto.

## Backup y restauración

- Backup manual: `bash deploy/staging/backup.sh`. Guarda un `pg_dump` custom en `backups/` con permisos privados; no lo sube a Git.
- Automatizar copias cifradas en almacenamiento externo con retención y alertas. La plantilla **no** programa backups; un cron o servicio de backup dedicado deberá configurarse.
- Restauración destructiva: detener escritores con `docker compose --env-file .env.staging -f compose.staging.yaml stop api`, luego `RESTORE_CONFIRM=RESTORE_STAGING bash deploy/staging/restore.sh backups/archivo.dump`. Reiniciar y comprobar `prisma migrate status`. Probar primero en una base desechable.

## Qué falta para producción

Rate limiting a nivel de gateway, escaneo de dependencias/contenedores, observabilidad, políticas de retención y datos de menores, OAuth real, auditoría de todos los roles, envío externo de avisos, pagos, pagos reversibles, cumplimiento legal y despliegue con cero downtime. No usar esta composición como afirmación de un producto lanzado.
