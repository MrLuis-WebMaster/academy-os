# AcademyOS — DDD y arquitectura hexagonal

## Estado

El backend se migra **por verticales funcionales**, manteniendo los endpoints existentes. Los contextos con capas de dominio, aplicación, infraestructura y presentación incluyen:

- `academics`: materias, cursos e inscripciones.
- `scheduling`: creación/listado/cancelación de sesiones, reservas, reprogramaciones, disponibilidad, ausencias y series semanales.
- `attendance`: registro privado de asistencia.
- `classroom`: material educativo HTTPS y estado de publicación.
- `learning`: generación opcional de prácticas y tutor con límites de acceso.
- `finance`: comprobantes de pagos manuales.
- `notifications` y `calendar`: bandeja privada y exportación ICS.

Las verticales de tenancy incluyen invitaciones y provisioning; commerce contiene Studio; academics, el temario y las asignaciones; learning, notas y prácticas. Persisten algunos controladores de consulta heredados. **ningún módulo se considera auditado o apto para producción por el mero hecho de tener cuatro capas**.

## Dependencias y capas

```text
apps/api/src/
  modules/academics/
    domain/             # Entidades, value objects, invariantes
    application/        # Casos de uso + contratos / puertos
    infrastructure/     # Adaptadores Prisma y servicios externos
    presentation/       # NestJS/HTTP y mapeo de excepciones
    academics.module.ts # Raíz de composición / DI
  shared/domain/        # Shared kernel mínimo y puro
  workspaces/           # Código legado pendiente de extraer
  scheduling/           # Código legado pendiente de extraer
  learning/             # Código legado pendiente de extraer
```

Las dependencias apuntan hacia dentro: HTTP → aplicación → dominio; infraestructura implementa los puertos definidos por la aplicación. **El dominio y la aplicación no importan NestJS, Prisma, HTTP ni implementaciones de almacenamiento.**

Los controladores de materias y cursos reciben `SubjectUseCases` y `CourseUseCases`. Estos casos de uso usan puertos (`SubjectRepository`, `CourseRepository`, `MembershipPort`) implementados por adaptadores Prisma. Las pruebas sustituyen esos adaptadores por implementaciones en memoria.

## Bounded contexts previstos

| Contexto | Responsabilidades |
|---|---|
| Identity & Tenancy | Better Auth, sesiones, workspace, roles, membresías |
| Academics | profesores, alumnos, materias, cursos, temario, matrículas |
| Scheduling | disponibilidad, citas, sesiones, cupos, cancelaciones, asistencia |
| Classroom | recursos, tareas, acceso al Aula Digital |
| Learning | Clase Viva, actividades, Pasaporte y ayudas IA |
| Commerce | Profe Studio, servicios, pagos, cobros, facturación |
| Notifications | Bandeja personal, read state, entrega in-app transaccional para cambios de agenda |
| Calendar | Serialización ICS, permisos por rol y consultas privadas por usuario |
| Integrations | Google Meet/Calendar, Zoom, Drive, email/push/WhatsApp y almacenamiento |

Los contextos se relacionan a través de casos de uso, puertos y eventos; **no** importando directamente controladores de otras áreas. El shared kernel solo contiene reglas con significado verdaderamente común (por ejemplo, normalización de slugs).

### Entrega de notificaciones sin eventos huérfanos

El adaptador de calendario y el de avisos respetan el alcance del usuario autenticado. Los avisos por cambio de clase se insertan mediante `notifyBookedStudents(tx, event)` dentro de la transacción PostgreSQL que cancela o reprograma la sesión. Una restricción única por `(workspaceId,userId,eventKey)` protege contra duplicados. La confirmación de matrículas y reservas usa además el mismo adaptador `notifyUser(tx,event)` para evitar lógica repetida. Ese puente reside **solo en infraestructura**; dominio y aplicación no importan Prisma. No hay aún una cola de entrega externa, outbox ni worker de correo.

## Calidad y reglas de evolución

1. La API valida permisos del workspace tanto en adaptadores como en casos de uso; no confiar únicamente en guards de frontend.
2. Cada regla de dominio recibe pruebas unitarias con inputs inválidos, acceso denegado y conflictos.
3. Los adaptadores reciben pruebas con PostgreSQL; mantener transacciones en operaciones de cupos, pagos y estados.
4. Los nuevos controladores son finos: parsear input, invocar caso de uso, transformar error esperado a HTTP.
5. Nunca entregar tokens OAuth ni configuración de infraestructura al dominio.
6. Reutilizar funciones de dominio y puertos cuando la semántica sea idéntica; evitar mega-servicios globales o herencias innecesarias.

## Fitness function en CI

`pnpm arch:check` verifica archivos de `modules/*/domain`, `modules/*/application`, `shared/domain` y `packages/ui`. Falla si detecta dependencias invertidas. El resto del backend deberá migrarse gradualmente sin renombrados masivos improvisados.

## Consistencia del calendario

La creación de excepciones y series semanales comparte la llave de advisory lock `academy-os:teacher:<teacherId>` con la creación/reprogramación de clases. Un bloqueo de ausencia no puede sobreescribir una clase ya confirmada. La expansión semanal está en el dominio puro y preserva la hora local de la zona horaria configurada; la infraestructura comprueba todos los choques y persiste todas las ocurrencias en una sola transacción. Ninguna regla de recurrencia depende de Prisma o NestJS.

## Próximas extracciones

Proyecciones de lectura heredadas → Integrations/OAuth → Auditoría, privacidad y preparación de release. Cada extracción conserva la ruta HTTP y va acompañada de pruebas de regresión.

## Asistencia aislada entre academias

La lectura `GET /bookings/staff` y la escritura `PATCH /bookings/:bookingId/attendance` se mantienen compatibles tras extraer `modules/attendance`. La aplicación valida el rol, el adaptador filtra por academia y profesor, y la escritura vuelve a comprobar permisos y cancelación dentro de una transacción PostgreSQL. Usa el mismo advisory lock de la sesión que las cancelaciones. Los alumnos no consultan listas de asistencia del personal.

## Classroom / materiales externos

`modules/classroom` separa reglas de enlaces HTTPS en el dominio, casos de uso en aplicación, puertos de acceso y Prisma en infraestructura, y el adaptador NestJS en presentación. Se conservan GET/POST `workspaces/:workspaceId/materials` y se incorpora PATCH `:materialId/publication` para publicar/retirar sin borrar recursos. Solo OWNER/ADMIN pueden gestionar; el repositorio revalida ese rol en la transacción junto con la pertenencia del curso. Los enlaces privados no se muestran al alumnado hasta estar publicados y matriculados; las referencias a proveedores OAuth siguen sin conectarse ni verificarse. No se autoriza procesamiento IA al agregar materiales.

## Gestión de sesiones — escritura transaccional y alcance docente

`modules/scheduling/domain/lesson.ts` aloja la validación de sesiones individuales y la regla de cancelación de clases completadas. `application/lesson-use-cases.ts` valida membresía; `infrastructure/prisma-lesson-repository.ts` revalida roles, profesor y curso dentro de la transacción de creación y cancelación. `presentation/lessons.controller.ts` preserva GET/POST `/sessions` y PATCH `/sessions/:sessionId/cancel`.

La creación utiliza el mismo advisory lock `academy-os:teacher:<id>` que series semanales, ausencias y reprogramaciones. La cancelación bloquea primero `academy-os:booking:<sessionId>`, luego al docente, y guarda los avisos a los alumnos reservados en la misma transacción. CANCELLED es idempotente y COMPLETED no puede cancelarse. El listado del personal docente ahora se limita al profesor autenticado; OWNER/ADMIN consultan toda su academia. No hay todavía correo ni mensajería externa.

## Controles nuevos de concurrencia y privacidad
Clase Viva serializa guardado/publicación por sesión; notas publicadas no se sobrescriben.
Prácticas serializa edición/publicación/intentos por actividad y cuenta intentos del alumno bajo bloqueo transaccional.
Tenancy bloquea por hash al aceptar invitaciones, por academia al limitar invitaciones y por usuario/solicitud al crear un workspace.
Commerce publica solo ofertas permitidas y filtra vínculos a cursos de otras academias.
Curriculum revalida asignación de profesor y pertenencia de curso y padre dentro de cada transacción.

## Proyecciones privadas por workspace
Los modelos de consulta del directorio se gestionan desde Tenancy; los cursos/sesiones/materiales para alumnos desde Classroom; el historial de reservas personales desde Scheduling. Revalidan membresía y filtran workspace y usuario antes de leer PostgreSQL. Solo OWNER/ADMIN reciben correos de miembros, mientras STUDENT solo ve su matrícula y contenido publicado.
