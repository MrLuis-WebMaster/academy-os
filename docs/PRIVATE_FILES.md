# Archivos privados — AcademyOS
Implementación inicial self-hosted, sin credenciales ni servicios externos. Se usa PostgreSQL como adaptador de almacenamiento transaccional para archivos pequeños. No es un reemplazo de object storage para producción a gran escala.

## Flujo
- OWNER/ADMIN gestionan archivos de su academia. TEACHER, solo cursos donde está asignado.
- Carga multipart con un archivo PDF, PNG o JPEG de hasta 5 MiB, título y curso. Firma binaria y MIME deben coincidir. Se normaliza el nombre. Cuota de 100 MiB y hasta 200 archivos por academia, con lock transaccional.
- Se crea como borrador y sin autorización de IA. Publicación y retirada explícitas. El alumno necesita rol STUDENT, matrícula en el curso y publicación activa para descargar.
- El endpoint de descarga no genera URLs públicas; revalida permisos en cada solicitud y fuerza attachment, no-store y nosniff. Eliminar borra el registro y el contenido por cascada. Copias previas y backups pueden conservarlo.
- La UI de Gestión real incorpora Archivos privados; los estudiantes acceden desde Materiales de Aula Digital. El catálogo de enlaces externos se mantiene separado.

## Configuración y pruebas
Desactivado por defecto: `ACADEMY_PRIVATE_FILES_ENABLED=false`. Aplicar migración `z9_private_material_files`. En un entorno de prueba controlado con archivos sintéticos, habilitar `ACADEMY_PRIVATE_FILES_ENABLED=true` en API. Desactivar impide cargas y nuevas publicaciones; permite retirar, eliminar y descargar archivos previamente autorizados.

Pruebas añadidas en `apps/api/src/integration/private-material-domain.test.ts` y `private-material-postgres.test.ts`. Se ejecutan como parte de `pnpm test` con PostgreSQL de CI. No se ha confirmado ejecución exitosa de CI ni probado upload HTTP real.

## Antes de producción
- La comprobación de firmas no detecta malware, PDFs activos o archivos políglotas. Integrar escaneo y cuarentena, límites por usuario y tasa, pruebas multipart y revisión de seguridad.
- Migrar el almacenamiento a un adaptador S3-compatible privado para grandes volúmenes, conservando el puerto de aplicación y los permisos. Revisar costos, cifrado, backup, retención, eliminación y recuperación.
- Google Drive, Dropbox y OneDrive siguen siendo conectores pendientes; los enlaces externos existentes no prueban permisos en esos proveedores.
