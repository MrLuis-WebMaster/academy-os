# Configurar acceso Google gratis (Better Auth)

Estado: el código está incluido; falta un cliente OAuth propio y un despliegue/DB de prueba. Google login **no** está operativo hasta configurar esas credenciales. Better Auth es software de código abierto, pero infraestructura y servicios externos pueden generar costos.

## 1. Instalar dependencias y base local

```bash
corepack enable
pnpm install
docker compose up -d
cp .env.example apps/api/.env
```

Configurar en `apps/api/.env`:
- `DATABASE_URL=postgresql://academy:academy_local@localhost:5432/academy_os?schema=public`
- `PORT=3001`
- `WEB_ORIGIN=http://localhost:5173`
- `BETTER_AUTH_URL=http://localhost:5173`
- `BETTER_AUTH_SECRET`: 32+ caracteres de alta entropía (`openssl rand -base64 32`).
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, definidos por Google Cloud.

No envíes secretos a GitHub ni uses estos valores de desarrollo en producción.

## 2. Configurar Google Cloud

1. Crear o seleccionar un proyecto en Google Cloud Console.
2. Configurar la pantalla de consentimiento OAuth y añadir usuarios de prueba, si el proyecto sigue en modo Testing.
3. Crear un cliente OAuth de tipo **Web application**.
4. Authorized JavaScript origins: `http://localhost:5173`.
5. Authorized redirect URIs: `http://localhost:5173/api/auth/callback/google`.
6. Copiar ID y secreto en `apps/api/.env`. Solo se piden scopes de identidad; **no** Calendar/Drive.

En producción debe usarse HTTPS, la misma URL pública para el frontend/API (mediante proxy para `/api`) y la URI de callback equivalente `https://<dominio>/api/auth/callback/google`. Configurar trusted origins y cookies seguras.

## 3. Base de datos y lanzamiento

```bash
pnpm db:validate
pnpm db:generate
pnpm db:migrate
pnpm dev
```

En desarrollo, `pnpm db:migrate` creará/aplicará una migración. Antes de producción, revisar y versionar SQL de migraciones, y utilizar `prisma migrate deploy` con respaldos. No ejecutar `db push` destructivo sobre bases con datos.

Abrir `http://localhost:5173` → **Continuar con Google** → asistente de 3 pasos. En el paso final se crea un workspace y su primer rol `OWNER` de manera transaccional. No se crea una cuenta administradora adicional.

## 4. Alcance y siguientes pasos

- La vista principal **Gestión real** permite registrar materias, cursos y clases con enlaces HTTPS manuales o ubicación física.
- **Ver prototipo** sigue mostrando una experiencia de demostración con cifras ficticias.
- Google Meet, Zoom y Drive requieren conexiones adicionales; iniciar sesión con Google no concede esos permisos.
- Antes de clientes reales: E2E OAuth, pruebas de aislamiento con Postgres, control de consentimientos/menores, recuperación de propietario, suscripciones, auditoría, protección contra abuso y backups.

Fuentes:
- https://better-auth.com/docs/authentication/google
- https://better-auth.com/docs/adapters/prisma
- https://better-auth.com/docs/integrations/express
