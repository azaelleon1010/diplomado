# TramaTech ERP — ConvOps
## Especificación funcional, visual y técnica para la construcción del ERP

> **Documento maestro para OpenCode**
>
> Proyecto: TramaTech ERP / ConvOps  
> Industria: Manufactura de textiles técnicos y componentes para automoción  
> Tamaño de referencia: ~300 empleados  
> Plataforma: Web + móvil  
> Stack base: React Native / React Native Web, Node.js / Express, TypeScript, MongoDB Atlas  
> Redis: opcional; actualmente deshabilitado en desarrollo con `REDIS_ENABLED=false`
>
> **Referencia visual:**  
> https://dribbble.com/shots/27445231-Enterprise-ERP-Dashboard-Sidebar-Navigation
>
> El diseño de referencia se utiliza como inspiración para la estructura de navegación, jerarquía visual, sidebar, estados activos/hover, búsqueda/command palette y lenguaje de aplicación empresarial. No copiar assets, logotipo, textos o identidad de la referencia. La identidad final es TramaTech.

---

# 1. VISIÓN DEL PRODUCTO

## 1.1 Nombre

**TramaTech ERP**

## 1.2 Concepto

**ERP Conversacional (ConvOps)**

El ERP debe combinar dos formas de operación:

1. **Interfaz ERP tradicional moderna**, para supervisores, administradores, finanzas y usuarios que necesitan consultar tablas, indicadores, reportes y operaciones complejas.
2. **Interfaz conversacional**, para operarios y empleados que necesitan ejecutar acciones rápidas mediante lenguaje cotidiano.

La idea central es:

> El usuario no debe aprender dónde está una función. Debe poder pedir lo que necesita.

Ejemplos:

```text
"Saca 50 rollos de tela sintética del almacén B para la orden 104"

"Falla en la hiladora 4, banda rota"

"¿Cuántos días de vacaciones me quedan?"

"Registra la ausencia de Juan Pérez de hoy"

"¿Cuánto inventario queda del material MAT-204?"
```

La plataforma transforma estas solicitudes en:

```text
Texto humano
    ↓
Normalización
    ↓
Detección de intención
    ↓
Extracción de entidades
    ↓
Validación de permisos
    ↓
Validación de reglas de negocio
    ↓
Confirmación cuando corresponda
    ↓
Transacción ERP
    ↓
Respuesta clara al usuario
    ↓
Auditoría
```

---

# 2. PRINCIPIOS DEL PRODUCTO

## 2.1 Conversacional primero

La conversación debe ser una capacidad de primer nivel, no una ventana decorativa añadida a un ERP tradicional.

Debe existir un acceso visible y permanente al asistente.

## 2.2 No esconder la operación

La IA puede facilitar la operación, pero el ERP debe conservar:

- trazabilidad;
- permisos;
- validaciones;
- auditoría;
- confirmaciones;
- historial.

## 2.3 No confiar ciegamente en el lenguaje natural

Las acciones con impacto financiero, inventario, producción, nómina, compras o movimientos irreversibles deben pasar por validaciones estrictas.

El asistente nunca debe ejecutar una operación de alto impacto solamente porque "parece entender" al usuario.

## 2.4 La información estructurada sigue siendo fundamental

Las tablas, filtros, dashboards, reportes y formularios continúan existiendo.

Conversación y ERP estructurado deben coexistir.

## 2.5 Progressive disclosure

Mostrar primero lo importante.

No presentar decenas de opciones simultáneamente.

La navegación debe organizar los módulos por dominios y permitir expandirlos cuando sea necesario.

---

# 3. REFERENCIA DE DISEÑO

La referencia visual de Dribbble presenta una interfaz ERP empresarial con una sidebar navy, módulos organizados mediante secciones/accordions, búsqueda tipo command palette, estados diferenciados de navegación y un sistema tipográfico consistente.

Para TramaTech se conservarán estos principios:

- sidebar vertical;
- navegación por dominios;
- grupos colapsables;
- estado activo claramente visible;
- estado hover;
- sidebar expandida y contraída;
- command palette;
- layout de aplicación empresarial;
- contenido central limpio;
- dashboards con tarjetas e información operativa;
- tipografía consistente;
- densidad de información controlada;
- navegación preparada para muchos módulos.

La referencia original utiliza una estética navy con tipografía IBM Plex y command search. TramaTech debe adaptar estos conceptos a su propia identidad visual.

---

# 4. BRANDING TRAMATECH

## 4.1 Marca

**TramaTech**

## 4.2 Slogan

**La red que mueve tu producción.**

## 4.3 Personalidad

- industrial;
- tecnológica;
- precisa;
- confiable;
- eficiente;
- directa;
- profesional.

Evitar:

- diseño excesivamente gamer;
- exceso de gradientes;
- glassmorphism excesivo;
- animaciones innecesarias;
- lenguaje infantil;
- UI sobrecargada.

---

# 5. IDENTIDAD VISUAL

## 5.1 Colores base

Cobalto:

```text
#0047AB
```

Cian/verde neón:

```text
#00FFCC
```

Gris pizarra:

```text
#2F4F4F
```

## 5.2 Colores derivados

Crear tokens derivados para:

- background principal;
- surface;
- surface elevated;
- border;
- text primary;
- text secondary;
- text muted;
- success;
- warning;
- danger;
- info;
- disabled.

No introducir una segunda paleta arbitraria.

El cian debe utilizarse principalmente como:

- CTA;
- indicador AI;
- estado activo especial;
- foco;
- acciones principales;
- indicadores de asistencia.

No utilizar cian en grandes superficies si reduce la legibilidad.

## 5.3 Modo oscuro

El sistema debe tener como experiencia principal un modo oscuro moderno inspirado en el contexto industrial/tecnológico.

Usar fondos oscuros para:

- shell de aplicación;
- sidebar;
- top bar;
- superficies de navegación.

La zona de información principal puede utilizar superficies claras o dark surfaces cuidadosamente diferenciadas.

La implementación debe respetar accesibilidad y contraste.

---

# 6. LOGOTIPO

Concepto:

Hexágono construido mediante líneas entrelazadas simulando hilos de un telar.

El logo debe comunicar:

- tecnología;
- red;
- manufactura;
- tejido;
- datos.

Crear inicialmente una versión vectorial/simple utilizando código o un SVG propio si el proyecto ya dispone de soporte para SVG.

No descargar ni copiar el logotipo de terceros.

Debe existir como componente reutilizable:

```text
TramaTechLogo
```

Con variantes:

- icon-only;
- icon + wordmark;
- compact;
- monochrome.

---

# 7. ARQUITECTURA VISUAL DE LA APLICACIÓN

Layout principal:

```text
┌───────────────────────────────────────────────────────────────┐
│ Top Bar                                                       │
├───────────────┬───────────────────────────────────────────────┤
│               │                                               │
│   Sidebar     │                Main Content                  │
│               │                                               │
│   Logo        │   Breadcrumb / Page Header                   │
│   Search      │                                               │
│               │   Dashboard / Module / Assistant              │
│   Modules     │                                               │
│               │                                               │
│               │                                               │
│   Assistant   │                                               │
│   User        │                                               │
│               │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

En móvil:

```text
┌─────────────────────────────┐
│ Header / Context            │
├─────────────────────────────┤
│                             │
│ Main Content                │
│                             │
│                             │
├─────────────────────────────┤
│ Home | Assistant | Alerts   │
└─────────────────────────────┘
```

La sidebar se convierte en drawer en pantallas pequeñas.

---

# 8. SIDEBAR

## 8.1 Comportamiento

Debe soportar:

- expandida;
- contraída;
- grupos colapsados;
- grupos expandidos;
- active;
- hover;
- focus;
- disabled;
- badge;
- contador;
- permisos.

## 8.2 Ancho conceptual

Crear tokens para:

```text
sidebar.expanded
sidebar.collapsed
```

No hardcodear estos valores en múltiples componentes.

## 8.3 Estructura

Propuesta inicial:

```text
TRAMATECH
ERP

⌘K  Buscar

INICIO
  Dashboard
  Mi trabajo

OPERACIONES
  Producción
  Inventario
  Almacenes
  Mantenimiento
  Calidad

ABASTECIMIENTO
  Compras
  Proveedores
  Recepción

COMERCIAL
  Clientes
  Ventas
  Pedidos

FINANZAS
  Contabilidad
  Cuentas por cobrar
  Cuentas por pagar
  Tesorería

PERSONAS
  Empleados
  Asistencia
  Vacaciones

DATOS
  Productos
  Materiales
  Maquinaria
  Centros de trabajo

ANALÍTICA
  KPIs
  Reportes
  BI

INTEGRACIONES
  Conectores
  APIs
  Webhooks

ADMINISTRACIÓN
  Usuarios
  Roles y permisos
  Organización
  Configuración

ASISTENTE CONVOPS
  Abrir asistente
```

Los módulos pueden aumentar posteriormente sin rediseñar la navegación.

---

# 9. COMMAND PALETTE

Inspirado en la command search del diseño de referencia.

Atajos:

```text
Ctrl + K
```

y en plataformas que lo soporten:

```text
Cmd + K
```

## Capacidades futuras

Debe permitir buscar:

- módulos;
- páginas;
- registros;
- órdenes;
- productos;
- empleados;
- máquinas;
- acciones;
- comandos del asistente.

Ejemplo:

```text
Buscar...

> compra 104
> mantenimiento hiladora 4
> inventario tela sintética
> crear orden de compra
```

La command palette debe ser reutilizable y desacoplada del backend.

---

# 10. DASHBOARD EJECUTIVO / OPERATIVO

La primera pantalla después de iniciar sesión debe mostrar información útil y no solamente tarjetas decorativas.

Nombre sugerido:

**Centro de Operaciones**

## Métricas iniciales

Ejemplos:

- Producción del día;
- órdenes activas;
- utilización de almacenes;
- máquinas detenidas;
- incidencias abiertas;
- compras pendientes;
- inventario crítico;
- entregas próximas.

## Componentes

```text
Header
  "Centro de Operaciones"

Actions
  + Nueva orden
  Asistente

KPI Cards

Production vs Plan
Warehouse Utilization
Maintenance Status
Recent Production Orders
Critical Inventory
Recent Activity
```

Utilizar datos mock realistas cuando el backend todavía no proporcione datos.

No fingir que los datos mock provienen de MongoDB.

---

# 11. CENTRO DE OPERACIONES TRAMATECH

El dashboard debe priorizar información propia de manufactura textil.

Ejemplos de indicadores:

```text
Producción:
92.4% del plan

Órdenes activas:
18

Máquinas operativas:
47 / 52

Paros de producción:
3

Inventario crítico:
8 materiales

Almacén:
82% ocupado

Pedidos pendientes:
12
```

Los números anteriores son ejemplos visuales.

En la implementación inicial se podrán utilizar datos mock explícitos.

---

# 12. ASISTENTE CONVOPS

## 12.1 Experiencia

El asistente debe sentirse como un centro de operaciones, no como un chat genérico.

Nombre:

**ConvOps Assistant**

Subtítulo:

**La red que mueve tu operación.**

## 12.2 Entrada

Campo de texto grande:

```text
¿Qué necesitas hacer?
```

Placeholder:

```text
"Registra una falla", "consulta inventario", "crea una orden..."
```

Atajos sugeridos:

```text
Inventario
Mantenimiento
Producción
RRHH
```

## 12.3 Respuestas

Las respuestas deben ser:

- directas;
- concretas;
- orientadas a la acción.

Ejemplo:

```text
Inventario actualizado.

Material: Tela sintética TS-204
Movimiento: -50 rollos
Almacén: B
Orden: OT-104

Disponible: 12 rollos
```

Evitar:

```text
¡Hola! 😊 ¡Con muchísimo gusto puedo ayudarte...
```

---

# 13. PROCESAMIENTO DEL LENGUAJE NATURAL

El pipeline conceptual es:

```text
rawMessage
   ↓
normalization
   ↓
intent detection
   ↓
entity extraction
   ↓
business validation
   ↓
permission validation
   ↓
confirmation policy
   ↓
command execution
   ↓
transaction
   ↓
response
   ↓
audit
```

## 13.1 Normalización

Debe existir una función reutilizable.

Debe:

- conservar el mensaje original;
- generar una versión normalizada;
- manejar diacríticos;
- normalizar espacios;
- eliminar ruido innecesario;
- manejar emojis cuando no aporten semántica;
- normalizar signos cuando corresponda.

IMPORTANTE:

Nunca destruir el mensaje original.

Guardar:

```text
rawMessage
normalizedMessage
```

para auditoría y depuración.

## 13.2 Entidades

Ejemplos:

```text
50
rollos
tela sintética
almacén B
orden 104
```

Convertir a estructura:

```json
{
  "quantity": 50,
  "unit": "rollos",
  "item": "tela sintética",
  "warehouse": "B",
  "orderId": "104"
}
```

## 13.3 Intenciones

Crear un catálogo inicial:

```text
inventory.withdraw
inventory.receive
inventory.transfer

maintenance.reportFailure
maintenance.createWorkOrder

production.queryOrder
production.reportOutput

hr.queryVacation
hr.reportAbsence

purchasing.createRequest
purchasing.queryOrder

system.search
system.help
```

No crear cientos de intents desde el primer sprint.

---

# 14. POLÍTICA DE CONFIRMACIÓN

La IA nunca debe saltarse las reglas del ERP.

Clasificación:

### Lectura

Ejemplo:

```text
"¿Cuánto inventario queda?"
```

Puede ejecutarse directamente.

### Acción de bajo impacto

Puede ejecutarse directamente cuando las reglas lo permitan.

### Acción sensible

Requiere confirmación explícita.

Ejemplos:

- retirar inventario;
- transferir inventario;
- crear orden de compra;
- modificar nómina;
- aprobar pagos;
- cancelar órdenes.

Flujo:

```text
Asistente:
"He identificado:

Retirar 50 rollos
Tela sintética
Almacén B
Orden 104

Disponible después del movimiento: 12 rollos.

¿Confirmas?"

Usuario:
"Sí"

Sistema:
"Movimiento realizado."
```

---

# 15. MODELO DE PERMISOS

El asistente debe ejecutar las mismas reglas de autorización que la interfaz tradicional.

No crear un bypass por ser IA.

La autorización debe considerar:

```text
tenant
organization
user
role
permissions
resource
action
```

Ejemplo:

```text
inventory.read
inventory.write
inventory.transfer
inventory.adjust
maintenance.create
maintenance.assign
hr.read.self
hr.read.team
hr.write
```

---

# 16. MULTI-TENANCY

La plataforma debe conservar separación estricta entre organizaciones.

Cada entidad de negocio relevante deberá asociarse al contexto correspondiente.

Concepto:

```text
tenantId
```

como identificador canónico de aislamiento, salvo que el proyecto actual ya tenga una convención distinta establecida.

No permitir:

```text
Tenant A → datos Tenant B
```

La UI también debe respetar permisos:

- no mostrar módulos no autorizados;
- no habilitar acciones no autorizadas;
- no confiar únicamente en ocultar botones.

El backend es la autoridad final.

---

# 17. MÓDULOS FUNCIONALES

## 17.1 Operaciones

### Producción

- órdenes de producción;
- centros de trabajo;
- operaciones;
- materiales;
- consumo;
- producción reportada;
- paros;
- scrap;
- OEE posteriormente.

### Inventario

- artículos;
- materiales;
- existencias;
- movimientos;
- ajustes;
- transferencias;
- lotes;
- números de serie.

### Almacenes

- almacenes;
- ubicaciones;
- recepción;
- picking;
- movimientos.

### Mantenimiento

- máquinas;
- activos;
- fallas;
- tickets;
- órdenes de mantenimiento;
- mantenimientos preventivos;
- historial.

### Calidad

- inspecciones;
- defectos;
- no conformidades;
- acciones correctivas.

---

# 18. ABASTECIMIENTO

### Compras

- solicitudes;
- cotizaciones;
- órdenes de compra;
- recepción.

### Proveedores

- maestro;
- contactos;
- condiciones;
- desempeño.

---

# 19. COMERCIAL

### Clientes

- cuentas;
- contactos;
- condiciones comerciales.

### Ventas

- oportunidades;
- pedidos;
- entregas;
- facturación posteriormente.

---

# 20. FINANZAS

Diseñar desde el inicio para soportar:

- cuentas contables;
- diario;
- cuentas por pagar;
- cuentas por cobrar;
- tesorería;
- centros de costo;
- periodos.

Las transacciones financieras importantes deberán ser auditables e idealmente inmutables una vez contabilizadas.

---

# 21. RECURSOS HUMANOS

Mínimo:

- empleados;
- asistencia;
- vacaciones;
- incidencias;
- nómina como módulo posterior.

El asistente podrá permitir consultas de autoservicio.

---

# 22. DATOS MAESTROS

Separar datos maestros de transacciones.

Primeros maestros:

```text
Products
Materials
Units
Warehouses
Locations
Machines
Employees
Suppliers
Customers
WorkCenters
```

---

# 23. AUDITORÍA DE OPERACIONES

Toda acción ejecutada por ConvOps que produzca cambios debe generar un registro de auditoría.

Conceptualmente:

```text
AuditLog
```

Campos:

```text
tenantId
userId
channel
intent
entityType
entityId
before
after
result
timestamp
correlationId
```

No guardar secretos.

---

# 24. MODELO DE CONVERSACIÓN

Crear conceptos separados:

```text
Conversation
ConversationMessage
AssistantAction
AssistantExecution
```

Ejemplo:

```text
Conversation
  └── Message
       ├── rawMessage
       ├── normalizedMessage
       ├── intent
       ├── entities
       ├── status
       └── assistantAction
```

Estados posibles:

```text
received
understood
awaiting_confirmation
executing
completed
failed
cancelled
```

---

# 25. CANALES FUTUROS

La arquitectura debe permitir varios canales sin duplicar la lógica de negocio:

```text
Web
React Native
Telegram
WhatsApp
API
```

Todos deben terminar en una capa de aplicación común.

Conceptualmente:

```text
Telegram Adapter
WhatsApp Adapter
Web Chat Adapter
Mobile Adapter
       ↓
ConvOps Application
       ↓
ERP Commands / Queries
       ↓
Domain
       ↓
Persistence
```

Nunca duplicar lógica de inventario por cada canal.

---

# 26. ARQUITECTURA TÉCNICA

La arquitectura debe mantener una separación razonable:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↓
Ports
    ↓
Infrastructure
```

No convertir artificialmente todo el sistema en Clean Architecture si eso genera más complejidad de la que elimina.

## Reglas

El dominio no debería depender directamente de:

- Express;
- HTTP;
- MongoDB;
- Redis;
- Telegram;
- WhatsApp.

Los adapters deben vivir fuera del dominio.

---

# 27. MONGODB ATLAS

MongoDB Atlas continúa siendo el System of Record.

Utilizar:

- repositories;
- indexes;
- tenant-aware queries;
- optimistic concurrency cuando corresponda;
- timestamps;
- audit references.

No crear una colección por tenant.

---

# 28. EVENTOS

Preparar arquitectura para:

```text
Domain Event
    ↓
Outbox
    ↓
Worker/Event Dispatcher
    ↓
Consumers
```

Ejemplos:

```text
InventoryMoved
ProductionOrderCreated
MachineFailureReported
PurchaseOrderCreated
EmployeeAbsenceReported
```

No introducir una infraestructura de message broker pesada en la primera etapa si todavía no existe necesidad real.

---

# 29. REDIS

Redis es opcional.

Estado actual:

```text
REDIS_ENABLED=false
```

No modificar este comportamiento solamente para construir la UI.

El sistema debe continuar funcionando correctamente sin Redis en desarrollo.

---

# 30. FRONTEND

## Objetivo

Crear un design system pequeño y reusable.

Componentes iniciales:

```text
AppShell
Sidebar
SidebarGroup
SidebarItem
TopBar
CommandPalette
PageHeader
Breadcrumbs
Card
MetricCard
DataTable
Badge
Button
Input
SearchInput
Modal
Drawer
Toast
EmptyState
StatusIndicator
AssistantPanel
ChatMessage
AssistantInput
```

No crear componentes duplicados.

---

# 31. TOKENS DE DISEÑO

Centralizar:

```text
colors
spacing
radii
shadows
typography
breakpoints
sidebar dimensions
z-index
transitions
```

Ejemplo conceptual:

```text
color.brand.primary
color.ai.accent
color.surface
color.background
color.text.primary
color.text.secondary
color.status.success
color.status.warning
color.status.danger
```

---

# 32. TIPOGRAFÍA

La referencia visual utiliza IBM Plex como sistema tipográfico.

Para TramaTech:

- preferir IBM Plex Sans si está disponible y es compatible;
- conservar una tipografía legible para números y tablas;
- no descargar fuentes innecesarias si ya existe un sistema tipográfico en el proyecto.

Jerarquías:

```text
Display
H1
H2
H3
Body
Body Small
Caption
Numeric / KPI
```

---

# 33. TABLAS ERP

Las tablas son esenciales.

Requisitos:

- sticky header cuando sea útil;
- búsqueda;
- filtros;
- ordenamiento;
- paginación;
- columnas configurables posteriormente;
- estados;
- selección;
- acciones por fila;
- responsive behavior.

No convertir tablas empresariales en tarjetas gigantes en escritorio.

---

# 34. RESPONSIVE

## Desktop

Sidebar completa.

## Tablet

Sidebar colapsable.

## Mobile

Drawer + navegación inferior opcional.

En móvil, el asistente debe ser especialmente accesible.

El operador debe poder:

```text
abrir asistente
escribir
confirmar
recibir respuesta
```

con mínima navegación.

---

# 35. ACCESIBILIDAD

Mínimo:

- navegación por teclado;
- focus states;
- aria labels cuando aplique;
- contraste;
- botones accesibles;
- estados no comunicados únicamente mediante color;
- textos alternativos;
- touch targets adecuados.

---

# 36. MICROINTERACCIONES

Usar animación solamente cuando:

- indique transición;
- confirme una acción;
- ayude a comprender el estado.

No utilizar:

- animaciones continuas;
- fondos animados;
- efectos excesivos;
- grandes delays artificiales.

---

# 37. DATOS MOCK

Mientras un módulo no tenga backend real, usar datos mock explícitos.

Debe quedar claro en el código:

```text
MOCK DATA
```

No mezclar mock data silenciosamente con datos reales de MongoDB.

Crear una capa que posteriormente pueda reemplazarse por API real.

---

# 38. ESTRUCTURA DE RUTAS CONCEPTUAL

Ejemplo:

```text
/dashboard

/assistant

/operations/production
/operations/inventory
/operations/warehouses
/operations/maintenance
/operations/quality

/procurement/purchases
/procurement/suppliers

/sales/customers
/sales/orders

/finance/accounting
/finance/payables
/finance/receivables

/people/employees
/people/attendance
/people/vacations

/master-data/products
/master-data/materials
/master-data/machines

/analytics
/integrations
/administration
```

Adaptar estas rutas al router existente.

No introducir un router paralelo.

---

# 39. FASES DE IMPLEMENTACIÓN

## Fase 1 — Shell y experiencia principal

Implementar primero:

- AppShell;
- branding TramaTech;
- sidebar;
- navegación;
- sidebar collapse;
- active states;
- top bar;
- command palette;
- dashboard Centro de Operaciones;
- AssistantPanel;
- responsive web;
- mobile drawer/estructura básica.

Esta es la primera fase que debe ejecutar OpenCode.

## Fase 2 — Inventario y almacenes

- artículos;
- existencias;
- movimientos;
- almacenes;
- ubicaciones;
- primera acción conversacional real.

## Fase 3 — Mantenimiento

- activos;
- máquinas;
- tickets;
- reporte de fallas por asistente;
- alertas.

## Fase 4 — Producción

- órdenes;
- operaciones;
- consumo;
- producción reportada.

## Fase 5 — Compras

- proveedores;
- solicitudes;
- órdenes.

## Fase 6 — RRHH

- empleados;
- vacaciones;
- asistencia.

## Fase 7 — Finanzas

- catálogo;
- diario;
- CxP;
- CxC;
- tesorería.

## Fase 8 — ConvOps avanzado

- Telegram;
- WhatsApp;
- voz;
- RAG;
- workflows;
- herramientas del agente;
- aprobaciones;
- automatizaciones.

---

# 40. REGLA DE DESARROLLO INCREMENTAL

NO implementar todo el ERP en una sola operación.

Cada iteración debe producir una mejora visible y verificable.

Prioridad:

```text
1. Shell
2. Navegación
3. Dashboard
4. Assistant UI
5. Primer flujo ERP real
6. Módulos progresivos
```

---

# 41. REGLAS PARA OPENCODE

Antes de modificar:

1. Inspeccionar el repositorio actual.
2. Identificar qué ya existe.
3. Reutilizar componentes existentes.
4. Reutilizar router existente.
5. Reutilizar sistema de estilos existente.
6. Reutilizar configuración existente.

No crear una segunda implementación del mismo concepto.

No reemplazar tecnologías existentes sin necesidad.

No ejecutar una auditoría completa del repositorio durante cada tarea.

No reorganizar carpetas masivamente.

No actualizar dependencias masivamente.

No modificar MongoDB durante la Fase 1 salvo que una necesidad real lo exija.

No tocar Redis durante la Fase 1.

---

# 42. CRITERIOS DE CALIDAD

Cada incremento debe comprobar:

```text
TypeScript
Lint
Build
Existing tests
New tests where relevant
```

El resultado visual debe comprobarse en:

```text
Desktop
Tablet
Mobile
```

Cuando sea posible.

---

# 43. CRITERIOS DE ACEPTACIÓN — FASE 1

La Fase 1 se considera terminada cuando:

- TramaTech aparece correctamente;
- logo/branding funciona;
- sidebar abre/cierra;
- grupos se expanden/colapsan;
- active state funciona;
- navegación básica funciona;
- command palette funciona con Ctrl+K / Cmd+K según plataforma;
- dashboard se muestra;
- KPI cards funcionan;
- widgets operativos funcionan con mock data;
- AssistantPanel funciona visualmente;
- conversación tiene estados básicos;
- responsive funciona;
- mobile no se rompe;
- no se alteró la conexión actual de MongoDB;
- Redis permanece deshabilitado;
- no existen secretos nuevos;
- typecheck pasa;
- build pasa;
- lint pasa si existe;
- tests existentes no empeoran.

---

# 44. DOCUMENTACIÓN

Mantener documentación mínima:

```text
docs/
  PRODUCT.md
  UX.md
  ARCHITECTURE.md
  CONVOPS.md
  MODULES.md
  TESTING.md
  CHANGELOG.md
```

Cada implementación debe agregar una entrada en:

```text
docs/CHANGELOG.md
```

con:

```text
Fecha
Fase
Cambios
Archivos principales
Pruebas realizadas
Pendientes
```

---

# 45. RESULTADO ESPERADO

TramaTech no debe verse como un dashboard genérico.

Debe sentirse como:

> Un centro de operaciones industrial moderno, donde el ERP tradicional y la inteligencia conversacional viven en la misma plataforma.

Visualmente:

```text
Industrial
+
Enterprise
+
AI
+
Operational
+
Clean
```

Funcionalmente:

```text
ERP tradicional
       +
Conversational ERP
       +
Workflow
       +
Auditability
```

El objetivo final es que un empleado pueda decidir:

```text
"¿Navego por el ERP?"
```

o simplemente:

```text
"Le pregunto al ERP."
```

y ambas experiencias terminen ejecutando las mismas reglas de negocio.
