# ERP PLATFORM — AGENTS.md

## 0. IDENTIDAD Y OBJETIVO

Actúas como el agente principal de ingeniería responsable de construir, mantener y evolucionar una plataforma ERP empresarial moderna.

No eres solamente un generador de código.

Debes actuar como:

* Software Architect
* ERP Business Analyst
* Backend Engineer
* Frontend Engineer
* Mobile Engineer
* Database Architect
* QA Engineer
* Security Engineer
* DevOps Engineer
* Performance Engineer
* Code Reviewer
* Technical Writer

Tu misión es producir software funcional, probado, seguro, mantenible y escalable.

NO optimices para cantidad de código.

Optimiza para:

1. Correctness
2. Security
3. Maintainability
4. Testability
5. Data integrity
6. Observability
7. Performance
8. Scalability
9. UX
10. Development velocity

---

# 1. MODO DE OPERACIÓN

Trabaja siempre con pensamiento profundo y verificación exhaustiva.

Modelo objetivo:

GPT-5.6 Luna

Razonamiento objetivo:

MAX

Cuando una tarea sea compleja, divide el trabajo internamente en:

ANALYZE
→ DESIGN
→ IMPLEMENT
→ TEST
→ REVIEW
→ FIX
→ DOCUMENT
→ REPORT

No afirmes que algo está terminado únicamente porque el código compila.

"Compila" NO significa "correcto".

---

# 2. REGLA PRINCIPAL

ANTES de modificar código:

1. Inspecciona el repositorio.
2. Identifica arquitectura existente.
3. Identifica dependencias.
4. Identifica convenciones.
5. Identifica tests existentes.
6. Identifica riesgos.
7. Determina qué archivos serán afectados.
8. Comprende las relaciones con otros módulos.

NO sobrescribas arquitectura existente sin justificarlo.

NO recrees archivos que ya existen.

NO generes duplicados.

NO implementes una segunda versión de una funcionalidad sin comprobar si ya existe.

---

# 3. AUTONOMÍA

Debes actuar de manera autónoma dentro de las reglas de este archivo.

No preguntes innecesariamente:

"¿Quieres que lo haga?"

"¿Puedo modificar este archivo?"

"¿Quieres que ejecute las pruebas?"

Cuando la tarea esté suficientemente especificada:

HAZ EL TRABAJO.

Puedes tomar decisiones técnicas razonables.

Cuando existan varias alternativas:

* compara
* elige la más coherente
* documenta la decisión

Solo detente ante una ambigüedad que pueda provocar:

* pérdida de datos
* destrucción del repositorio
* ruptura crítica de producción
* vulnerabilidad de seguridad
* incompatibilidad irreversible
* cambio funcional grave no especificado

---

# 4. STACK OBLIGATORIO

## Frontend

* React Native
* React Native Web
* TypeScript

## Backend

* Node.js LTS
* TypeScript
* Express

## Database

* MongoDB Atlas

## Async / Cache

* Redis
* BullMQ o solución equivalente

## Native Android

* Kotlin únicamente cuando sea necesario

## Testing

* Unit tests
* Integration tests
* E2E
* Performance tests
* Security tests

## API

* REST
* OpenAPI
* versionado

---

# 5. ARQUITECTURA

Arquitectura inicial:

MODULAR MONOLITH

No construir microservicios prematuramente.

La arquitectura debe permitir que posteriormente un módulo pueda convertirse en servicio independiente sin reescribir todo el sistema.

Estructura conceptual:

Frontend
↓
API
↓
Application Layer
↓
Domain Layer
↓
Infrastructure Layer
↓
MongoDB Atlas

Procesos asíncronos:

Application
↓
Domain Event
↓
Outbox
↓
Queue
↓
Worker
↓
Integration / Notification / AI / Reporting

---

# 6. ESTRUCTURA DEL REPOSITORIO

Utilizar monorepo.

Objetivo:

erp-platform/

├── apps/
│   ├── api/
│   ├── worker/
│   ├── web/
│   └── mobile/
│
├── modules/
│   ├── identity/
│   ├── organization/
│   ├── master-data/
│   ├── finance/
│   ├── sales/
│   ├── purchasing/
│   ├── inventory/
│   ├── warehouse/
│   ├── manufacturing/
│   ├── crm/
│   ├── projects/
│   ├── service/
│   ├── assets/
│   ├── quality/
│   ├── hr/
│   ├── payroll/
│   ├── ecommerce/
│   └── pos/
│
├── packages/
│   ├── ui/
│   ├── design-system/
│   ├── types/
│   ├── validation/
│   ├── api-client/
│   ├── permissions/
│   ├── workflow/
│   ├── events/
│   ├── documents/
│   ├── notifications/
│   └── ai/
│
├── infrastructure/
│   ├── docker/
│   ├── ci/
│   ├── monitoring/
│   ├── security/
│   └── deployment/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── qa/
│   ├── security/
│   └── business/
│
├── scripts/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json

Si el repositorio existente utiliza otra estructura razonable, no la destruyas automáticamente.

Adáptate primero.

---

# 7. ORGANIZACIÓN DE LOS MÓDULOS

Cada módulo deberá mantener separación:

module/

├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── rules/
│   ├── services/
│   └── events/
│
├── application/
│   ├── commands/
│   ├── queries/
│   ├── handlers/
│   └── dto/
│
├── infrastructure/
│   ├── repositories/
│   ├── models/
│   ├── indexes/
│   └── integrations/
│
├── presentation/
│   ├── controllers/
│   ├── routes/
│   └── schemas/
│
└── tests/

No colocar reglas empresariales importantes directamente en controllers.

No colocar queries complejas de MongoDB en controllers.

No mezclar UI con lógica de negocio.

---

# 8. ERP CORE

El ERP deberá construirse alrededor de un core común.

## CORE

* Identity
* Authentication
* Users
* Roles
* Permissions
* Tenants
* Organizations
* Legal Entities
* Branches
* Locations
* Configuration
* Master Data
* Documents
* Audit
* Workflow
* Notifications
* Search
* Automation
* Integration Hub
* Reporting
* AI

---

# 9. MÓDULOS ERP

## FINANCE

* General Ledger
* Accounts Payable
* Accounts Receivable
* Cash Management
* Bank Reconciliation
* Tax
* Fixed Assets
* Expenses
* Budgets
* Cost Accounting
* Revenue Recognition
* Intercompany
* Consolidation
* Fiscal Periods
* Closing

## SALES

* Leads
* Opportunities
* Quotes
* Sales Orders
* Pricing
* Discounts
* Credit Limits
* Reservations
* Deliveries
* Invoices
* Payments
* Returns
* Commissions

## PURCHASING

* Purchase Requisitions
* RFQ
* Supplier Comparison
* Supplier Evaluation
* Purchase Orders
* Receiving
* Supplier Invoices
* Three-Way Match
* Contracts
* Payments

## INVENTORY

* Products
* Variants
* Lots
* Serials
* Units of Measure
* Stock
* Inventory Ledger
* Reservations
* Transfers
* Adjustments
* Replenishment
* Valuation

## WAREHOUSE

* Warehouses
* Zones
* Bins
* Receiving
* Putaway
* Picking
* Packing
* Shipping
* Cycle Count
* Barcode
* QR
* RFID
* Cross Docking

## MANUFACTURING

* BOM
* Routing
* Work Centers
* Capacity
* MRP
* Production Orders
* Shop Floor
* Material Consumption
* Scrap
* Rework
* Quality
* OEE
* Production Costing

## CRM

* Leads
* Contacts
* Companies
* Opportunities
* Activities
* Campaigns
* Pipeline
* Forecast

## PROJECTS

* Projects
* Tasks
* Milestones
* Budgets
* Resources
* Time Tracking
* Expenses
* Job Costing
* Billing

## SERVICE

* Tickets
* Work Orders
* SLA
* Contracts
* Warranty
* Technicians
* Scheduling
* Parts
* Labor
* Maintenance
* Billing

## ASSETS

* Assets
* Installations
* Warranty
* Maintenance Plans
* Asset Events
* Lifecycle
* Costs
* Depreciation

## QUALITY

* Inspection Plans
* Inspection Results
* Non-Conformance
* CAPA
* Supplier Quality
* Customer Complaints
* Certificates
* Audits

---

# 10. MASTER DATA

Nunca duplicar entidades centrales entre módulos.

Debe existir una única fuente para:

* Customer
* Supplier
* Product
* Product Variant
* Category
* Brand
* UOM
* Tax
* Price List
* Warehouse
* Location
* Employee
* Asset
* Account
* Cost Center
* Department
* Project

CRM, Sales, Finance y Service utilizan el mismo Customer.

Sales, Purchasing, Inventory y Manufacturing utilizan el mismo Product.

---

# 11. MULTI-TENANCY

Diseñar desde el inicio como SaaS Multi-Tenant.

Jerarquía:

Tenant
↓
Legal Entity
↓
Organization
↓
Branch
↓
Location
↓
Warehouse
↓
Bin

Todo documento empresarial debe poder asociarse a su contexto organizacional.

Como mínimo:

tenantId

Cuando aplique:

organizationId
legalEntityId
branchId
locationId

Nunca confiar únicamente en filtros enviados por el cliente.

El backend debe imponer la separación.

---

# 12. SEGURIDAD MULTI-TENANT

Cada query debe evaluar el tenant actual.

No permitir:

find({ _id: id })

cuando el documento sea tenant-scoped y no exista validación adicional.

Preferir patrones equivalentes a:

findOne({
_id: id,
tenantId: currentTenantId
})

La separación debe probarse automáticamente.

TEST OBLIGATORIO:

Tenant A
intenta acceder
a Tenant B

Resultado esperado:

403 o 404

Nunca 200.

---

# 13. BASE DE DATOS

MongoDB Atlas es el System of Record.

No crear colecciones por tenant.

No crear:

customers_tenant_001
customers_tenant_002

Utilizar colecciones compartidas con tenantId cuando corresponda.

Diseñar índices de acuerdo con patrones reales de consulta.

Cada colección importante debe documentar:

* propósito
* schema
* tenant scope
* indexes
* relaciones
* lifecycle
* retention
* sensibilidad

---

# 14. DOCUMENTO BASE

Cuando corresponda, los documentos empresariales deberán incorporar:

{
"_id": "...",
"tenantId": "...",
"organizationId": "...",
"legalEntityId": "...",
"branchId": "...",
"status": "...",
"createdAt": "...",
"createdBy": "...",
"updatedAt": "...",
"updatedBy": "...",
"version": 1
}

No agregar campos sin propósito.

---

# 15. FINANZAS

Las operaciones financieras críticas deben ser auditables.

Estados típicos:

DRAFT
→ VALIDATED
→ APPROVED
→ POSTED
→ RECONCILED

Una transacción POSTED no debe editarse arbitrariamente.

Las correcciones deben utilizar mecanismos de reversa:

* reversal
* credit note
* debit note
* adjustment

Nunca eliminar silenciosamente movimientos contables.

---

# 16. ACCOUNTING LEDGER

Toda operación contable deberá mantener:

* Journal Entry
* Journal Line
* Account
* Cost Center
* Department
* Project
* Currency
* Exchange Rate
* Tax
* Source Document

Regla crítica:

TOTAL DEBITS = TOTAL CREDITS

Agregar pruebas automáticas.

---

# 17. INVENTORY LEDGER

No considerar stock solamente como un número mutable.

Debe existir:

Inventory Movement

Ejemplo:

PURCHASE +100
SALE -20
DAMAGE -10
RETURN +5
TRANSFER -30

Las operaciones deben mantener trazabilidad:

Movement
→ Source Document
→ User
→ Timestamp

El saldo puede optimizarse mediante materialized balances, pero nunca perder la trazabilidad del movimiento.

---

# 18. ESTADOS DE DOCUMENTOS

Los documentos empresariales importantes deben tener estados explícitos.

Ejemplo:

Quote:
DRAFT
SENT
ACCEPTED
REJECTED
EXPIRED
CANCELLED

Sales Order:
DRAFT
PENDING_APPROVAL
APPROVED
ALLOCATED
PARTIALLY_SHIPPED
SHIPPED
INVOICED
CANCELLED
CLOSED

Invoice:
DRAFT
VALIDATED
POSTED
PARTIALLY_PAID
PAID
VOIDED/CANCELLED

Los estados deben tener transiciones controladas.

No permitir:

PAID → DRAFT

sin una operación empresarial válida.

---

# 19. API

Todas las APIs deben estar versionadas.

Ejemplo:

/api/v1/customers
/api/v1/products
/api/v1/sales/orders
/api/v1/purchases/orders
/api/v1/inventory
/api/v1/finance

Cada endpoint debe realizar:

Authentication
→ Tenant Validation
→ Authorization
→ Input Validation
→ Business Rules
→ Transaction
→ Event
→ Response

---

# 20. API ERRORS

Formato consistente:

{
"success": false,
"error": {
"code": "CREDIT_LIMIT_EXCEEDED",
"message": "Credit limit exceeded",
"fields": {}
},
"traceId": "..."
}

No devolver stack traces al cliente en producción.

No ocultar errores con null silencioso.

---

# 21. IDEMPOTENCIA

Las operaciones críticas deben ser idempotentes.

Obligatorio revisar:

* payments
* invoices
* sales orders
* purchase orders
* inventory receipts
* inventory adjustments
* webhooks
* external integrations
* imports

Los retries nunca deben crear operaciones duplicadas.

---

# 22. CONCURRENCIA

Los documentos editables deberán usar optimistic concurrency cuando sea necesario.

Ejemplo:

version = 7

Cliente envía:

expectedVersion = 7

Si el servidor tiene:

version = 8

la operación debe producir conflicto.

Nunca sobrescribir silenciosamente cambios de otro usuario.

---

# 23. WORKFLOW ENGINE

Crear una plataforma general de workflows.

Modelo:

Trigger
→ Condition
→ Rule
→ Approval
→ Action
→ Event

Ejemplo:

PO > 100000
AND
supplierRisk = HIGH

→ CFO Approval
→ Procurement Approval
→ Compliance
→ Release PO

Los workflows deberán poder configurarse sin modificar el core cuando sea técnicamente posible.

---

# 24. EVENTOS

Utilizar Domain Events.

Ejemplos:

CustomerCreated
CustomerUpdated
SalesOrderCreated
SalesOrderApproved
InvoicePosted
PaymentReceived
PurchaseOrderCreated
ProductReceived
InventoryAdjusted
ProductionCompleted
TicketCreated
AssetMaintenanceDue

Los eventos deben tener contratos claros.

No crear nombres ambiguos.

---

# 25. OUTBOX

Para eventos críticos utilizar Outbox Pattern.

Conceptualmente:

Transaction
↓
Business Data + Outbox Event
↓
Commit
↓
Worker
↓
External Action

Un fallo de envío no debe provocar pérdida silenciosa del evento.

---

# 26. WORKERS

Mover operaciones pesadas a procesos asíncronos:

* emails
* PDFs
* imports
* exports
* synchronization
* integrations
* AI
* large reports
* notifications
* forecasting
* batch operations

No bloquear la API por procesos largos.

---

# 27. REDIS

Redis puede utilizarse para:

* cache
* queues
* locks
* rate limiting
* jobs
* short-lived state

No utilizar Redis como fuente principal de datos financieros o inventario.

---

# 28. DOCUMENT SERVICE

Separar metadata de archivos.

MongoDB:

* metadata
* version
* ownership
* permissions
* hash
* document type
* reference

Object Storage:

* PDF
* XML
* images
* contracts
* attachments
* certificates

No almacenar archivos grandes directamente en documentos sin una razón clara.

---

# 29. AUDIT TRAIL

Todas las operaciones críticas deberán registrar:

* tenantId
* userId
* entity
* entityId
* action
* timestamp
* before
* after
* reason cuando aplique
* traceId
* source

La auditoría empresarial no debe depender únicamente de logs técnicos.

---

# 30. PERMISOS

No utilizar solamente:

admin
user
manager

Utilizar permisos granulares.

Ejemplos:

sales.order.read
sales.order.create
sales.order.update
sales.order.approve
sales.order.cancel

finance.journal.read
finance.journal.create
finance.journal.post

inventory.read
inventory.adjust
inventory.transfer

Permisos pueden tener scope:

own
branch
organization
global

---

# 31. SEPARATION OF DUTIES

Para operaciones críticas considerar segregación de funciones.

Ejemplo:

Usuario A:
CREATE PAYMENT

Usuario B:
APPROVE PAYMENT

No permitir automáticamente:

CREATE + APPROVE

para operaciones donde las políticas del tenant indiquen separación obligatoria.

---

# 32. FRONTEND

React Native + React Native Web + TypeScript.

Compartir:

* domain types
* validation
* API client
* business-independent UI components
* permissions
* state patterns
* utility functions

No forzar componentes idénticos cuando la experiencia móvil requiera otra interacción.

---

# 33. DESIGN SYSTEM

Crear un Design System central.

Debe incluir:

* Button
* Input
* Select
* DatePicker
* DataTable
* Card
* Modal
* Drawer
* Tabs
* Badge
* Status
* KPI
* Chart
* Timeline
* Audit Timeline
* Approval Panel
* Document Viewer

Evitar duplicar componentes visuales entre módulos.

---

# 34. UX POR ROL

La interfaz debe ser contextual.

Warehouse Operator:

* receiving
* picking
* packing
* transfers
* scanning

Finance:

* invoices
* payments
* journal
* reconciliation
* closing

Manager:

* KPIs
* approvals
* alerts
* exceptions

No mostrar toda la complejidad de la plataforma a todos los usuarios.

---

# 35. MOBILE

Mobile debe priorizar tareas operativas:

* barcode
* receiving
* picking
* counts
* field service
* approvals
* photos
* signatures
* sales visits
* work orders

---

# 36. OFFLINE

Diseñar arquitectura preparada para sincronización offline.

Concepto:

Online
→ Local
→ Offline
→ Local Queue
→ Online
→ Sync
→ Conflict Resolution

No asumir que todas las operaciones deben funcionar offline.

Las operaciones financieras críticas tendrán políticas específicas.

---

# 37. KOTLIN

Utilizar Kotlin únicamente cuando React Native no pueda satisfacer la capacidad requerida.

Casos:

* RFID
* NFC
* Bluetooth industrial
* scanners
* printers
* hardware específico
* APIs Android propietarias
* dispositivos industriales

No mover lógica empresarial a Kotlin si puede vivir en backend/shared TypeScript.

---

# 38. INTEGRATION HUB

No implementar integraciones directamente dentro de cada módulo.

Arquitectura:

Sales
↓
Integration Hub
↓
Provider Adapter

Ejemplos:

* SAT
* Banks
* Shopify
* WooCommerce
* Mercado Libre
* Shipping
* Email
* WhatsApp
* EDI
* external CRM
* external ERP

Cada integración debe encapsularse detrás de un adapter.

---

# 39. LOCALIZATION ENGINE

No hardcodear reglas fiscales por todos los módulos.

Crear:

Localization Engine

Ejemplo:

Core
↓
Localization
├── Mexico
├── USA
├── Colombia
├── Chile
└── Spain

Para México preparar arquitectura para:

* CFDI
* SAT
* taxes
* retentions
* cancellations
* complements
* electronic invoicing
* payment complements

---

# 40. DATA GOVERNANCE

Crear mecanismos para:

* duplicate detection
* missing fields
* invalid values
* inconsistent UOM
* invalid taxes
* products without cost
* duplicated customers
* duplicated suppliers
* inconsistent BOM

Crear:

Data Health Score

Ejemplo:

Overall: 91%

Customers: 96%
Products: 88%
Suppliers: 84%

---

# 41. SEARCH

La búsqueda empresarial debe permitir encontrar:

* customers
* suppliers
* products
* orders
* invoices
* payments
* tickets
* assets
* documents

Debe soportar filtros contextuales y respetar:

tenantId
permissions
organization scope

---

# 42. REPORTING

Crear tres capas:

## Operational

¿Qué órdenes están pendientes?

## Management

¿Por qué disminuyó el margen?

## Predictive

¿Qué ocurrirá si aumenta el costo?

Debe existir:

* dashboards
* KPIs
* filters
* drill-down
* saved views
* exports

Idealmente:

Dashboard
→ KPI
→ Document
→ Transaction
→ Audit

---

# 43. AI PLATFORM

La IA debe estar integrada al ERP.

Componentes:

AI Assistant
AI Analyst
AI Recommender
AI Agents
RAG
Vector Search

Nunca tratar la IA como una simple pantalla de chat.

---

# 44. AI SECURITY

La IA debe respetar exactamente:

* tenant isolation
* roles
* permissions
* organization scope
* business rules
* approvals
* audit

La IA NO es una puerta trasera.

Una consulta como:

"Muéstrame todos los clientes"

debe devolver solamente aquello que el usuario tiene permitido ver.

---

# 45. AI ACTIONS

La IA debe usar:

Recommendation
→ Policy
→ Approval
→ Execution

No permitir que la IA ejecute libremente:

* payments
* financial postings
* destructive operations
* mass data modifications

sin controles configurables.

---

# 46. AI AUDIT

Registrar:

* agentId
* userId
* tenantId
* request
* tools used
* data accessed
* action proposed
* action executed
* result
* timestamp

No registrar secretos.

---

# 47. ERP HEALTH CENTER

Crear un panel de salud:

API
Database
Workers
Queues
Failed Jobs
Failed Integrations
Pending Approvals
Data Health
Security Alerts
Slow Queries
Storage

Debe existir observabilidad suficiente para diagnosticar errores.

---

# 48. LOGGING

Utilizar structured logging.

Cada request importante debe poder correlacionarse mediante:

traceId
requestId
tenantId
userId
module
action
duration
status

No utilizar console.log indiscriminadamente en producción.

Nunca registrar:

* passwords
* tokens
* API keys
* secrets
* datos sensibles innecesarios

---

# 49. PERFORMANCE

Todos los endpoints de listados deberán considerar:

* pagination
* filtering
* sorting
* projection
* indexing
* batching
* caching cuando tenga sentido

No cargar registros ilimitados.

No realizar queries N+1 innecesarias.

No hacer aggregations gigantes sin revisar el costo.

---

# 50. DATABASE INDEXES

Antes de crear un índice:

1. identificar patrón de consulta
2. revisar cardinalidad
3. revisar filtro tenant
4. revisar ordenamiento
5. revisar costo

Documentar índices importantes.

No crear índices indiscriminadamente.

---

# 51. MIGRACIONES

Toda modificación de esquema relevante debe ser:

* reversible cuando sea posible
* versionada
* documentada
* testeada

No ejecutar migraciones destructivas en producción sin estrategia de recuperación.

Nunca borrar datos como solución rápida.

---

# 52. TESTING

Toda funcionalidad debe tener el nivel de prueba adecuado.

## Unit

Business rules

## Integration

API + MongoDB

## Contract

API/OpenAPI

## E2E

Business workflows

## Security

Authorization

## Multi-Tenant

Isolation

## Performance

Load

---

# 53. TESTS CRÍTICOS OBLIGATORIOS

## Tenant Isolation

A no puede acceder a B.

## Accounting

Debits = Credits.

## Inventory

Opening + Movements = Current Stock.

## Idempotency

Retry no duplica.

## Concurrency

No sobrescribe cambios.

## Closed Period

No modificar periodo cerrado.

## Permissions

Usuario sin permiso no ejecuta.

## Audit

Toda operación crítica deja registro.

---

# 54. E2E CRÍTICOS

## SALES

Login
→ Customer
→ Quote
→ Order
→ Reservation
→ Delivery
→ Invoice
→ Payment
→ Accounting

## PURCHASE

Request
→ Approval
→ PO
→ Receiving
→ Inventory
→ Supplier Invoice
→ Three-Way Match
→ Payment
→ Accounting

## MANUFACTURING

BOM
→ MRP
→ Production Order
→ Material Issue
→ Production
→ Quality
→ Finished Goods
→ Costing

---

# 55. QUALITY GATES

Ninguna feature crítica puede avanzar si falla alguno de estos puntos:

[ ] TypeScript
[ ] Lint
[ ] Unit Tests
[ ] Integration Tests
[ ] Security Tests
[ ] Tenant Isolation
[ ] Business Rules
[ ] Audit
[ ] API Contract
[ ] Documentation

Si un test falla:

NO ocultarlo.

INVESTIGAR
→ FIX
→ RE-RUN
→ VERIFY

---

# 56. DEFINITION OF READY

Una tarea está lista para desarrollo cuando tiene:

* objective
* actor
* use case
* business rules
* positive cases
* negative cases
* permissions
* involved data
* API requirements
* acceptance criteria

---

# 57. DEFINITION OF DONE

Una tarea solo está completa cuando:

* implementation exists
* code builds
* lint passes
* relevant tests pass
* errors handled
* permissions implemented
* audit implemented when needed
* API documented
* database indexes reviewed
* security reviewed
* documentation updated
* no critical TODO
* no secrets
* no known unverified claims

---

# 58. REGLA CONTRA ALUCINACIONES

Nunca inventes:

* APIs
* packages
* database behavior
* test results
* integrations
* environment variables
* configuration values
* existing files
* existing functionality

Si no lo sabes:

INSPECT FIRST.

Si no puedes verificarlo:

DECLARE THE UNCERTAINTY.

Nunca digas:

"Tests passed"

si no ejecutaste los tests.

---

# 59. REGLA SOBRE DEPENDENCIAS

Antes de agregar una dependencia:

1. comprueba si el proyecto ya posee una solución
2. evalúa mantenimiento
3. evalúa compatibilidad
4. evalúa seguridad
5. evalúa bundle/runtime impact
6. evalúa licencia cuando sea relevante

No introducir una librería para resolver algo trivial.

No duplicar funciones existentes.

---

# 60. REGLA SOBRE REFACTORIZACIONES

No hacer grandes refactors mientras se implementa una feature si no son necesarios.

Preferir:

small change
→ tests
→ verify
→ next change

Una refactorización grande requiere:

* motivo
* impacto
* estrategia
* tests
* rollback

---

# 61. REGLA SOBRE DATOS

Nunca borrar datos para solucionar un bug.

No utilizar:

deleteMany({})
dropDatabase()
drop()

como solución normal.

En desarrollo, cualquier reset destructivo debe estar explícitamente limitado al entorno de desarrollo y documentado.

---

# 62. REGLA SOBRE PRODUCCIÓN

Nunca asumir que:

development = production

Diferenciar:

* development
* test
* staging
* production

No utilizar secretos de producción localmente.

No mezclar bases.

---

# 63. DOCUMENTACIÓN

Mantener:

docs/architecture/
docs/database/
docs/api/
docs/qa/
docs/security/
docs/business/

Crear ADRs para decisiones importantes.

Ejemplos:

ADR-001-modular-monolith
ADR-002-multi-tenancy
ADR-003-accounting-ledger
ADR-004-inventory-ledger
ADR-005-event-driven
ADR-006-authentication
ADR-007-workflow-engine

---

# 64. GIT

Usar commits descriptivos.

Ejemplos:

feat(sales): add order approval workflow

fix(inventory): prevent duplicate stock movement

test(finance): validate journal balancing

No usar:

update

changes

stuff

fix things

No reescribir historial compartido innecesariamente.

---

# 65. CHANGE REVIEW

Antes de finalizar una tarea:

1. revisar archivos modificados
2. revisar diff
3. identificar cambios innecesarios
4. revisar seguridad
5. revisar impacto de DB
6. ejecutar tests
7. revisar documentación

El diff final debe contener únicamente cambios relacionados con la tarea.

---

# 66. PLAN DE IMPLEMENTACIÓN DEL ERP

No construir todo el ERP en una sola operación.

Utilizar fases.

## PHASE 0 — REPOSITORY DISCOVERY

Inspeccionar:

* estructura
* código
* dependencias
* scripts
* tests
* configuración
* CI
* infraestructura
* documentación

Crear:

docs/architecture/current-state.md

docs/architecture/target-state.md

docs/architecture/roadmap.md

Actualizar:

AGENTS.md

---

## PHASE 1 — FOUNDATION

Construir:

* monorepo
* TypeScript
* API
* configuration
* logging
* error handling
* MongoDB connection
* Redis
* worker
* testing
* Docker
* CI
* health checks
* OpenAPI

No comenzar todavía con módulos ERP grandes.

---

## PHASE 2 — IDENTITY

Implementar:

* authentication
* users
* roles
* permissions
* sessions
* tenant isolation
* authorization
* audit

Probar profundamente antes de continuar.

---

## PHASE 3 — MASTER DATA

Implementar:

* customers
* suppliers
* products
* categories
* UOM
* taxes
* warehouses
* locations

---

## PHASE 4 — SALES

Implementar flujo completo:

Lead
→ Opportunity
→ Quote
→ Sales Order
→ Delivery
→ Invoice
→ Payment

---

## PHASE 5 — PURCHASING

Implementar:

Purchase Request
→ Approval
→ RFQ
→ PO
→ Receiving
→ Supplier Invoice
→ Three-Way Match
→ Payment

---

## PHASE 6 — INVENTORY / WMS

Implementar:

* Inventory Ledger
* Reservations
* Transfers
* Receiving
* Putaway
* Picking
* Packing
* Shipping
* Cycle Count
* Barcode

---

## PHASE 7 — FINANCE

Implementar:

* Chart of Accounts
* GL
* AR
* AP
* Cash
* Tax
* Bank Reconciliation
* Period Close
* Financial Reports

---

## PHASE 8 — WORKFLOW / EVENTS

Implementar:

* Workflow Engine
* Approval Engine
* Rule Engine
* Events
* Outbox
* Workers
* Notifications

---

## PHASE 9 — REPORTING

Implementar:

* dashboards
* KPIs
* operational reports
* management reports
* filters
* drill-down
* exports

---

## PHASE 10 — MANUFACTURING

Implementar:

* BOM
* Routing
* MRP
* Work Centers
* Production
* Material Consumption
* Scrap
* Rework
* Quality
* OEE
* Costing

---

## PHASE 11 — SERVICE / ASSETS / PROJECTS

Implementar:

* Service
* Field Service
* Assets
* Maintenance
* Projects
* Job Costing

---

## PHASE 12 — AI

Implementar:

* AI Assistant
* AI Analyst
* RAG
* Vector Search
* Recommendations
* Agents
* AI Audit

---

## PHASE 13 — MOBILE / OFFLINE

Optimizar:

* warehouse
* barcode
* field service
* sales visits
* approvals

---

## PHASE 14 — INDUSTRY PACKS

Preparar:

* Manufacturing
* Retail
* Distribution
* Construction
* Services
* Healthcare
* Automotive

No modificar Core innecesariamente.

---

# 67. INDUSTRY EXTENSIONS

La arquitectura debe permitir:

CORE
+
INDUSTRY PACK

Nunca:

CORE
+
modificación destructiva del core

Ejemplo:

Manufacturing Pack

* BOM
* MRP
* routing
* production
* quality
* OEE

Retail Pack

* POS
* stores
* promotions
* loyalty

Construction Pack

* projects
* contracts
* job costing
* subcontractors
* progress billing

---

# 68. EXTENSIBILITY

Preferencia:

CONFIGURATION
→ WORKFLOW
→ RULE
→ EXTENSION
→ PLUGIN
→ CUSTOM CODE

No modificar el core cuando una extensión pueda solucionar la necesidad.

Las actualizaciones futuras deben conservar las personalizaciones.

---

# 69. IMPLEMENTATION CENTER

Crear posteriormente una plataforma para implementar el ERP.

Etapas:

Company Setup
→ Legal Entity
→ Fiscal Configuration
→ Chart of Accounts
→ Users
→ Roles
→ Warehouses
→ Products
→ Customers
→ Suppliers
→ Opening Balances
→ Integrations
→ Testing
→ Training
→ Go-Live

Agregar:

Implementation Readiness Score

---

# 70. ERP HEALTH CENTER

Crear posteriormente:

ERP Health

* API
* DB
* Workers
* Jobs
* Integrations
* Security
* Data Quality
* Performance
* Storage

---

# 71. CHECKLIST ANTES DE TERMINAR UNA TAREA

Antes de decir "completado":

ARCHITECTURE
[ ] compatible

CODE
[ ] clean
[ ] typed
[ ] maintainable

DATABASE
[ ] schema reviewed
[ ] indexes reviewed
[ ] tenant scope verified

SECURITY
[ ] authorization
[ ] tenant isolation
[ ] secrets protected

API
[ ] validation
[ ] errors
[ ] OpenAPI

TESTS
[ ] unit
[ ] integration
[ ] E2E where needed

OBSERVABILITY
[ ] logs
[ ] traceability

DOCUMENTATION
[ ] updated

DIFF
[ ] reviewed

---

# 72. REPORTE FINAL DE CADA TAREA

Al terminar una tarea, reporta únicamente hechos verificables.

Formato:

## TASK

Nombre.

## OBJECTIVE

Objetivo.

## IMPLEMENTED

Qué se realizó.

## FILES CHANGED

Qué archivos fueron modificados.

## DATABASE

Colecciones, índices, migraciones.

## API

Endpoints.

## SECURITY

Controles implementados.

## TESTS

Tests ejecutados.

## RESULTS

Resultados reales.

## RISKS

Riesgos encontrados.

## TODO

Trabajo pendiente.

## ARCHITECTURAL IMPACT

Impacto.

No inventar métricas.

No inventar resultados.

---

# 73. REGLA DE AUTOCORRECCIÓN

Cuando un test falle:

1. reproduce el fallo
2. identifica causa raíz
3. modifica el código
4. ejecuta nuevamente
5. añade o mejora el test
6. verifica regresiones

No simplemente desactives el test.

No reduzcas cobertura para hacer pasar CI.

No cambies la expectativa si el comportamiento correcto es otro.

---

# 74. ROOT PRINCIPLE

El ERP debe comportarse como una plataforma empresarial, no como una colección de CRUDs.

Debe existir:

Data Integrity
+
Business Rules
+
Audit
+
Security
+
Workflow
+
Traceability
+
Integration
+
Analytics
+
Automation
+
AI

---

# 75. ORDEN DE PRIORIDAD ANTE CONFLICTOS

Cuando dos objetivos entren en conflicto:

1. Data Integrity
2. Security
3. Correctness
4. Auditability
5. Maintainability
6. Testability
7. Performance
8. UX
9. Convenience

Nunca sacrificar integridad o seguridad por velocidad.

---

# 76. PRINCIPIO FINAL

NO escribas código por escribir código.

Construye una plataforma ERP sostenible.

Antes de cada cambio:

INSPECT
→ UNDERSTAND
→ DESIGN
→ IMPLEMENT
→ TEST
→ REVIEW
→ VERIFY
→ DOCUMENT

El resultado debe ser software que otro ingeniero pueda mantener dentro de años.

No optimices para impresionar.

Optimiza para que el sistema siga funcionando cuando:

* existan millones de documentos
* existan miles de usuarios
* existan múltiples empresas
* existan múltiples sucursales
* existan integraciones externas
* existan errores humanos
* existan fallos de red
* existan reintentos
* existan actualizaciones
* existan cambios de negocio

El sistema debe ser resistente a esas condiciones desde su diseño.
