# Solicitudes de compra de paquetes
Hito 28: flujo comercial manual con catálogo, orden e historial. No es una pasarela de pagos, factura ni conciliación bancaria.
- Estudiantes con membresía pueden solicitar paquetes activos de precio positivo, con matrícula cuando el paquete es de un curso. El servidor fija precio COP, créditos y días de vigencia; no acepta créditos ni importes arbitrarios. Una clave idempotente se vincula a cada solicitud y se limita a una pendiente por paquete y diez pendientes por alumno.
- OWNER/ADMIN revisa solicitudes de su academia. Solo se entregan créditos cuando el gestor declara haber verificado externamente el pago, registra referencia única por academia, importe exacto y nota. El registro de orden, asignación y aviso interno es transaccional; reintentos no crean otra asignación.
- Estados PENDING, FULFILLED, CANCELLED, REJECTED. El alumno cancela solo pendientes; el gestor rechaza pendientes. No se realizan reembolsos ni se mueve dinero. Resolver incidencias de pagos externos directamente con el proveedor. La referencia es una declaración administrativa, no prueba criptográfica del pago.
- El precio histórico de la orden no se altera; la emisión manual existente permanece independiente. No duplicar una transferencia entre ambas vías. Los registros pueden desaparecer por cascada al eliminar entidades; no constituyen un libro contable inmutable.
- Activar solo tras aplicar migración za_package_orders y configurar ACADEMY_PACKAGE_ORDERS_ENABLED=true. Por defecto está apagado; permite leer/cancelar/rechazar órdenes existentes, no crear ni entregar nuevas.
- Pruebas añadidas en apps/api/src/integration/package-orders.test.ts. CI y validación real pendientes.
## Próximos pasos
Pasarela por academia con cuenta comercial, checkout alojado, validación del servidor y eventos firmados, conciliación, reembolsos, manejo de impuestos y suscripciones. Separar el pago del alumno a su academia del cobro SaaS de AcademyOS a la academia.
