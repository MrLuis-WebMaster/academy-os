# AcademyOS

**Your academy. Your way.** SaaS educativo multi-tenant para profesores independientes y academias con múltiples docentes y materias.

> **Desarrollo activo — no apto aún para producción.** El código contiene flujos persistentes y una vista de demostración separada. Los proveedores externos y el checkout real no están conectados. El login Google necesita las credenciales OAuth del propietario y un despliegue HTTPS para validación completa.

## Tecnología
- **Web:** Vue 3, TypeScript 6, Tailwind CSS 4, Vite 8, Pinia, Vue Query.
- **API:** NestJS 12, TypeScript 7, Zod 4, Better Auth 1.7.27.
- **Datos:** PostgreSQL 19, Prisma 7.10, migraciones SQL versionadas.
- **Infraestructura:** Node.js 26 LTS, pnpm workspaces, Docker, GitHub Actions.
- **PWA:** manifest + servicio de caché **solo para activos públicos**, pantalla offline. Las páginas y respuestas privadas no se almacenan offline.

## Primera instalación

```bash
corepack enable
pnpm install
docker compose up -d
cp .env.example apps/api/.env
pnpm db:validate
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Frontend: http://localhost:5173 · API: http://localhost:3001/api/v1/health

El acceso real necesita configurar `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_URL`, `WEB_ORIGIN` y `DATABASE_URL`, según [guía de Google](docs/GOOGLE_LOGIN_SETUP.md). El repositorio es actualmente público: **jamás subas los secretos ni datos de alumnos**.

En producción usa migraciones revisadas con `prisma migrate deploy`, HTTPS y copias de seguridad; no ejecutes migraciones destructivas directamente sobre datos reales.

## Funciones presentes en código

- **Identidad y espacios:** Google/Better Auth alojado en el propio servidor, setup guiado de tres pasos, rol OWNER, múltiples workspaces, permisos y enlaces de invitación de un solo uso.
- **Gestión académica:** docentes, alumnos invitados, inscripciones, materias, cursos, subtemas y profesores asignados.
- **Agenda:** clases virtuales, presenciales e híbridas con enlace HTTPS manual; conflictos del docente, cancelación, reservas de alumnos con cupos transaccionales y asistencia.
- **Aula Digital:** clases, recursos HTTPS aprobados por el profesor, notas de Clase Viva, actividades prácticas con corrección y Pasaporte por resultados de ejercicios.
- **Clase Viva:** observaciones de clase y publicación revisada por el docente. Los ejercicios son **redactados manualmente**; la generación con IA sigue pendiente.
- **Profe Studio:** servicios con precio COP, duración y modalidad; página pública de marca activable por el propietario y URL de contacto externa. **No procesa pagos ni reservas públicas todavía.**
- **Finanzas:** registro **manual** de cobros ya recibidos, con anulación auditada; **no** emite facturas ni envía dinero.
- **Demostración:** el panel original sigue disponible como un prototipo con datos ficticios; no debe confundirse con la gestión real.

## Estructura del monorepo

```text
academy-os/
├── apps/
│   ├── api/                 NestJS + Prisma + módulos por dominio
│   └── web/                 Vue + Tailwind + PWA + aulas
├── docs/                    arquitectura, seguridad, roadmap, setup
├── .github/workflows/       validación en PostgreSQL 19 y CI
├── compose.yaml
├── package.json
└── pnpm-workspace.yaml
```

## Validación

```bash
pnpm db:validate
pnpm db:generate
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions ejecuta migraciones en PostgreSQL temporal, pruebas de reglas de negocio, compilación y smoke tests de API. Se incorporó una prueba de aislamiento entre academias y sobrecupo simultáneo; verificar que su última ejecución esté verde antes de desplegar.

## Estado y próximos pasos

- [Roadmap actualizado](docs/ROADMAP.md)
- [Estado de implementación](docs/IMPLEMENTATION_STATUS.md)
- [Lanzamiento seguro](docs/RELEASE_CHECKLIST.md)
- [Autenticación y onboarding](docs/AUTH_AND_ONBOARDING.md)
- [Integraciones externas](docs/INTEGRATIONS.md)
- [Seguridad y privacidad](docs/SECURITY.md)

**No completado:** OAuth y sincronización de Google Meet/Calendar, Zoom o Drive; generación de Clase Viva con IA, Profe SOS, procesamiento de pagos, recordatorios automáticos, acceso por dominio propio, recuperación de cuentas e instalación dedicada por token. Estas capacidades requieren código adicional, verificación con proveedores y en algunos casos credenciales privadas.
