# AcademyOS

**Your academy. Your way.** SaaS educativo multi-tenant para profesores independientes y academias con múltiples docentes y materias.

> **Desarrollo activo — no apto aún para producción.** El código contiene flujos persistentes y una vista de demostración separada. Los proveedores externos y el checkout real no están conectados. El login Google necesita las credenciales OAuth del propietario y un despliegue HTTPS para validación completa.

## Tecnología
- **Web:** Vue 3, TypeScript 6, Tailwind CSS 4, Vite 8, Pinia, Vue Query.
- **API:** NestJS 12, TypeScript 7, Zod 4, Better Auth 1.7.27.
- **Datos:** PostgreSQL 19, Prisma 7.10, migraciones SQL versionadas.
- **Infraestructura:** Node.js 26 LTS, pnpm workspaces con `pnpm-lock.yaml` versionado, Docker, GitHub Actions.
- **PWA:** manifest + servicio de caché **solo para activos públicos**, pantalla offline. Las páginas y respuestas privadas no se almacenan offline.

## Primera instalación

```bash
corepack enable
pnpm install --frozen-lockfile
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

## Arquitectura y sistema visual

- **DDD / hexagonal:** [`docs/ARCHITECTURE_DDD.md`](docs/ARCHITECTURE_DDD.md). Los contextos Academics, Scheduling, Learning, Notifications y Calendar contienen verticales mediante dominio, casos de uso, puertos e infraestructura Prisma. La migración de los demás contextos es progresiva.
- **Design System:** [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). Paquete de workspace `@academy-os/ui` con 14 primitivas, variables semánticas Tailwind 4, Lucide Icons y apariencia **clara, oscura o automática según el sistema**. La preferencia se conserva localmente.
- **Galería de componentes (solo desarrollo):** ejecutar `pnpm dev` y abrir `http://localhost:5173/?design-system=1`.
- **HTTP compartido:** `apps/web/src/shared/api-client.ts` centraliza transporte, errores y rutas por workspace, evitando implementaciones duplicadas en las pantallas.
- **Reglas obligatorias en CI:** `pnpm arch:check` evita dependencias de NestJS/Prisma en los módulos de dominio/aplicación nuevos y acoplamientos entre `@academy-os/ui` y las apps.

## Entregas recientes — DDD y aprendizaje

- **Academics/Enrollment** ahora tiene dominio, caso de uso, puertos y repositorio Prisma; la baja de un alumno cancela sus reservas futuras sin borrar historial.
- **Scheduling/Reschedule y Booking** tienen reglas de dominio, casos de uso y adaptadores transaccionales. La reprogramación conserva reservas y graba el historial; si hay alumnos reservados, se muestra un aviso de notificación manual.
- **Disponibilidad semanal:** franjas recurrentes por profesor y día, verificadas con la zona horaria de su academia. Nuevas sesiones y reprogramaciones comprueban esas franjas; sin configuración, el profesor sigue teniendo agenda libre.
- **Grupos:** el formulario de clases acepta de 1 a 500 cupos, no solo sesiones individuales.
- **Clase Viva con IA (opt-in):** el profesor solicita una práctica a partir de sus notas, revisa cada respuesta, edita el borrador y lo publica explícitamente. El proveedor de OpenAI está desactivado por defecto.
- **Profe SOS (opt-in):** un tutor utiliza únicamente notas aprobadas del curso en el que está inscrito el alumno y devuelve las clases consultadas; sin proveedor configurado no responde.
- **Cuotas:** hasta diez solicitudes de IA por academia y día (Clase Viva + Profe SOS en conjunto). No se almacena historial de chat de estudiantes.
- **Bandeja de avisos personales:** cada alumno con reserva recibe una notificación persistente cuando se cancela o reprograma su clase. Bandeja y contador de no leídas para cada workspace, con lectura individual, lectura masiva y aislamiento multi-tenant; las notificaciones se guardan en la misma transacción que el cambio de clase. **No** se envían correos, push ni WhatsApp.
- **Exportación de calendario:** descarga privada de `.ics` desde el encabezado, compatible con importación manual a Google Calendar, Apple Calendar y Outlook. Owners/admins ven clases del espacio; docentes, solo asignadas; alumnos, solo reservadas. **No es sincronización OAuth ni suscripción actualizable automáticamente.**

Guía técnica y privacidad: [Configuración de IA](docs/AI_PROVIDER_SETUP.md).

## Integraciones sin credenciales adicionales

- **Calendario ICS:** botón «Mi calendario» desde el encabezado, exportación autenticada y filtrada por rol; el archivo se puede **importar manualmente** en calendarios conocidos. Los cambios posteriores requieren descargarlo de nuevo.
- **Avisos internos:** en cancelaciones y reprogramaciones se generan para los alumnos con reservas activas, de forma atómica; no se contacta automáticamente a nadie fuera de AcademyOS.

## Funciones presentes en código

- **Identidad y espacios:** Google/Better Auth alojado en el propio servidor, setup guiado de tres pasos, rol OWNER, múltiples workspaces, permisos y enlaces de invitación de un solo uso.
- **Gestión académica:** docentes, alumnos invitados, inscripciones, materias, cursos, subtemas y profesores asignados.
- **Agenda:** clases virtuales, presenciales e híbridas con enlace HTTPS manual; franjas semanales, conflictos del docente, reprogramación auditada, reservas con cupos transaccionales, avisos in-app y asistencia.
- **Aula Digital:** clases, recursos HTTPS aprobados por el profesor, notas de Clase Viva, actividades prácticas con corrección y Pasaporte por resultados de ejercicios.
- **Clase Viva:** observaciones de clase y publicación revisada por el docente. Los ejercicios pueden redactarse manualmente o sugerirse por IA cuando se configure el proveedor; **siempre requieren revisión y publicación del profesor**.
- **Profe Studio:** servicios con precio COP, duración y modalidad; página pública de marca activable por el propietario y URL de contacto externa. **No procesa pagos ni reservas públicas todavía.**
- **Finanzas:** registro **manual** de cobros ya recibidos, con anulación auditada; **no** emite facturas ni envía dinero.
- **Demostración:** el panel original sigue disponible como un prototipo con datos ficticios; no debe confundirse con la gestión real.

## Estructura del monorepo

```text
academy-os/
├── apps/
│   ├── api/                 NestJS + Prisma + módulos por dominio
│   └── web/                 Vue + Tailwind + PWA + aulas
├── packages/ui/             Primitivas Vue, temas y tokens semánticos
├── docs/                    arquitectura, seguridad, roadmap, setup
├── .github/workflows/       validación en PostgreSQL 19 y CI
├── compose.yaml
├── package.json
├── pnpm-lock.yaml           Dependencias reproducibles
└── pnpm-workspace.yaml
```

## Validación

```bash
pnpm db:validate
pnpm db:generate
pnpm arch:check
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

**No completado:** OAuth y sincronización de Google Meet/Calendar, Zoom o Drive; verificación con credenciales reales de Clase Viva con IA y Profe SOS; procesamiento de pagos, recordatorios automáticos, acceso por dominio propio, recuperación de cuentas e instalación dedicada por token. Estas capacidades requieren código adicional, verificación con proveedores y en algunos casos credenciales privadas.
