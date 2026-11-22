# AcademyOS — DDD y arquitectura hexagonal

## Estado

El backend se está migrando **por verticales funcionales**, sin romper endpoints ya existentes. Las verticales migradas incluyen `academics/subjects`, `academics/courses`, `academics/enrollments`, `scheduling/bookings`, `scheduling/reschedule`, `scheduling/availability` los casos iniciales de IA en `learning`, la bandeja en `notifications` y la exportación privada en `calendar`. Los otros controladores aún son legado y están pendientes de refactor; no se deben presentar como DDD completos.

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

El adaptador de calendario y el de avisos respetan el alcance del usuario autenticado. Los avisos por cambio de clase se insertan mediante `notifyBookedStudents(tx, event)` dentro de la transacción PostgreSQL que cancela o reprograma la sesión. Una restricción única por `(workspaceId,userId,eventKey)` protege contra duplicados. Ese puente reside **solo en infraestructura**; dominio y aplicación no importan Prisma. No hay aún una cola de entrega externa, outbox ni worker de correo.

## Calidad y reglas de evolución

1. La API valida permisos del workspace tanto en adaptadores como en casos de uso; no confiar únicamente en guards de frontend.
2. Cada regla de dominio recibe pruebas unitarias con inputs inválidos, acceso denegado y conflictos.
3. Los adaptadores reciben pruebas con PostgreSQL; mantener transacciones en operaciones de cupos, pagos y estados.
4. Los nuevos controladores son finos: parsear input, invocar caso de uso, transformar error esperado a HTTP.
5. Nunca entregar tokens OAuth ni configuración de infraestructura al dominio.
6. Reutilizar funciones de dominio y puertos cuando la semántica sea idéntica; evitar mega-servicios globales o herencias innecesarias.

## Fitness function en CI

`pnpm arch:check` verifica archivos de `modules/*/domain`, `modules/*/application`, `shared/domain` y `packages/ui`. Falla si detecta dependencias invertidas. El resto del backend deberá migrarse gradualmente sin renombrados masivos improvisados.

## Próximas extracciones

Scheduling asistencia y excepciones de disponibilidad → Learning publicación de actividades y evidencia → Tenancy provisioning/invitations → Finance → Integrations. Cada extracción conserva la ruta HTTP y va acompañada de pruebas de regresión.
