# ERP Platform — Estado actual (Fase 0: auditoría)

**Fecha:** 2026-10-06
**Rama / commit auditado:** `feat/api-auth-mongo` @ `65b84d3`
**Alcance:** auditoría del código. No se implementó ninguna funcionalidad nueva.
**Método:** lectura del código fuente, ejecución de typecheck/tests/lint y sondeo sin credenciales de la API desplegada. Todo lo que no se pudo verificar se marca como **no verificado**.

---

## 1. Resumen ejecutivo

| Aspecto | Estado |
|---|---|
| Arquitectura | Monolito modular en Express con capas `domain/application/infrastructure/presentation` en los 7 módulos. Se respeta de forma consistente. |
| Multi-tenant | Sólido. `tenantId` sale siempre del JWT; repositorios filtran por tenant; tests de aislamiento existen. |
| Identidad | Completa para la fase: registro de empresa, login por empresa, refresh rotativo, logout, `/me`, usuarios, roles (sin CRUD de roles vía API). |
| Inventario | **Catálogo** (productos, categorías, almacenes). **No hay existencias ni libro de movimientos.** Web y Mobile sincronizados vía API. |
| Producción / Compras / Mantenimiento / RRHH / Finanzas | Existe backend real con máquina de estados y auditoría, y pantallas **móviles** reales. **En Web son placeholders.** |
| Integración entre módulos | Solo **referencial** (Compras y Producción validan productos del catálogo). Ningún módulo mueve inventario ni genera contabilidad. |
| Finanzas | Ingresos/gastos simples por cuenta. **No es contabilidad de partida doble** (no hay pólizas, débitos/créditos ni periodos). |
| Calidad | Typecheck OK en todos los workspaces. 194 tests pasan, 41 omitidos, **5 archivos de integración fallan (fixtures desactualizados, preexistente)**. Lint: 21 errores y 44 advertencias preexistentes. |
| Despliegue | API en Render (`diplomado-1.onrender.com`, rama `feat/api-auth-mongo`), Web en Cloudflare (static assets), APK release firmado con **keystore de debug**. |

Conclusión: la base (multi-tenant, identidad, patrón de módulos, concurrencia optimista, auditoría) es reutilizable y debe preservarse. Lo que falta es, sobre todo, **el núcleo transaccional del ERP**: libro de inventario, contabilidad de partida doble, integraciones entre módulos y las pantallas Web de los módulos operativos.

---

## 2. Arquitectura actual

```
apps/web (React 18 + Vite + react-native-web)  ─┐
apps/mobile (React Native 0.87, React 19)       ─┼─► HTTPS ─► apps/api (Express 5 + TS) ─► MongoDB Atlas (erp_platform)
                                                  │                    │
packages/types (contratos compartidos parciales) ─┘                    └─► Redis/BullMQ (deshabilitado: REDIS_ENABLED=false)
apps/worker (BullMQ, placeholder sin jobs)
```

### 2.1 Monorepo (npm workspaces)

| Paquete | Propósito | Observaciones |
|---|---|---|
| `apps/api` | API REST `/api/v1` | Build `tsc` → `dist/apps/api/src/index.js`. No consume `@erp/types`. |
| `apps/web` | SPA de administración | Build `tsc -b && vite build` → `dist`. `VITE_API_URL` (fallback `http://localhost:3000`). Sourcemaps de producción activados. |
| `apps/mobile` | App operativa Android | `API_BASE_URL` fijo en `src/lib/api.ts` (`https://diplomado-1.onrender.com`). Metro observa la raíz del monorepo. |
| `apps/worker` | Procesos asíncronos | Solo arranca si Redis está habilitado; procesador de ejemplo, sin jobs reales. |
| `packages/config` | Variables de entorno validadas con Zod | Rechaza `JWT_SECRET` por defecto en producción. Define `RATE_LIMIT_*`, `ENCRYPTION_KEY`, pero **no se usan**. |
| `packages/database` | Conexión Mongoose, `BaseRepository` (filtro de tenant, paginación, `updateById` con versión), `withTransaction`, `ensureIndexes`, mapeo de errores Mongo | Esquema base: `tenantId`, `createdBy`, `updatedBy`, `timestamps`, `versionKey: 'version'`, `optimisticConcurrency`. |
| `packages/errors` | `AppError` + códigos (`VALIDATION_ERROR`, `VERSION_CONFLICT`, …) | Usado por la API. |
| `packages/logger` | Pino + `redactSecrets` | Logs estructurados con `traceId`, `tenantId`, `userId`. |
| `packages/types` | Contratos compartidos | Hoy: tipos base (`BaseDocument`, paginación, `ApiSuccess/ApiError`, health), `dashboard.ts`, `inventory.ts` (Web+Mobile). El resto de DTOs está duplicado en clientes y API. |

### 2.2 Pipeline de una petición

`helmet → cors(CORS_ORIGIN) → compression → json(1mb) → traceMiddleware → requestLogger → authenticate (JWT + sesión viva + usuario/tenant activos) → requireTenant → requirePermission (roles resueltos en servidor) → Zod strict → caso de uso → repositorio (tenant-scoped) → auditEvents → respuesta { success, data, meta?, traceId }`.

Errores: `errorHandler` devuelve `{ success:false, error:{code,message,fields}, traceId }`; stack solo fuera de producción.

---

## 3. Módulos backend

Todos tienen `domain/ (entities, ports)`, `application/usecases.ts`, `infrastructure/ (models, repositories)`, `presentation/ (controllers, routes, schemas)`. Excepciones: `tenant` (sin presentación propia; usado por identidad) y `notifications` (solo puerto + adaptador Resend).

Observación de estructura: cada módulo tiene un único `usecases.ts` (entre ~300 y ~500 líneas). Funciona, pero crecerá a archivo monolítico si se agregan BOM, solicitudes de compra, etc. Recomendación: dividir por agregado (`application/<agregado>.usecases.ts`) al extender.

### 3.1 Identity (`/api/v1/auth`, `/api/v1/me`, `/api/v1/users`)

| Entidad | Colección | Notas |
|---|---|---|
| Tenant | `tenants` | `tenantId` (`tnt_…` o id del seed), `name`, `slug` único, `status ACTIVE/DISABLED`. |
| User | `users` | Único por `(tenantId,email)`. `status ACTIVE/DISABLED`. |
| Role | `roles` | `permissions[]`. Único por `(tenantId,name)`. |
| Membership | `memberships` | user↔tenant, `roleIds`, `organizationId?`, `branchId?`. |
| RefreshSession | `refreshSessions` | Hash del refresh token, rotación, TTL por `expiresAt`. |
| AuditEvent | `auditEvents` | Bitácora de negocio de **todos** los módulos. |

| Método | Ruta | Guard |
|---|---|---|
| GET | `/auth/tenant/:slug` | público (no documentado en OpenAPI) |
| POST | `/auth/register` | público — crea Tenant + rol `owner` (ALL_PERMISSIONS) + usuario + membership + sesión en una transacción |
| POST | `/auth/login` | público — `{email,password,tenantId?}`; con correo en varios tenants exige `tenantId` |
| POST | `/auth/refresh` | público — rotación |
| POST | `/auth/forgot-password` | público — siempre responde 200; nunca revela si el correo existe. Envía un enlace de un solo uso por Resend (añadido 2026-10-07) |
| POST | `/auth/reset-password` | público — consume el enlace (`resetId`+`token`), cambia la contraseña y revoca todas las sesiones del usuario (añadido 2026-10-07) |
| POST | `/auth/logout` | autenticado |
| GET | `/me` | autenticado |
| GET/POST | `/users` | `system.users.read` / `system.users.write` |
| GET | `/users/:id` | `system.users.read` |
| POST | `/users/:id/roles` | `system.users.write` |

Faltan: CRUD de roles, desactivar usuarios vía API, organizaciones/sucursales (los campos existen en membership, sin módulo). La recuperación de contraseña por correo (Resend) ya existe en backend y Web; falta el deep-link en Mobile para abrir el enlace del correo dentro de la app (hoy Mobile no tiene configurado ningún esquema de enlaces).

### 3.2 Inventory (`/api/v1/inventory`)

Entidades: `InventoryCategory` (`inventoryCategories`), `Product` (`products`: sku, nombre, unidad, barcode, costo, precio, stock mín/máx, `trackInventory`), `Warehouse` (`warehouses`). Estados `ACTIVE/INACTIVE`. `DELETE` = baja lógica (INACTIVE), categoría no se desactiva con productos activos.

Endpoints: CRUD (GET lista/detalle, POST, PATCH con `expectedVersion`, DELETE lógico) para `categories`, `products`, `warehouses`.
Permisos: `inventory.read/create/update/delete`.

**No existe:** existencias por almacén, libro de movimientos (`inventory.stock.in/out/adjust`, `withdraw`, `transfer` están en el catálogo de permisos pero **no hay endpoints**), lotes, series, UOM como catálogo, valuación de costo, ubicaciones/bins, tipos de producto (terminado/semiterminado/materia prima).

### 3.3 Production (`/api/v1/production`)

Entidad `ProductionOrder` (`productionOrders`): `code` único, `productId` (catálogo), `quantity`, `producedQuantity`, `machine?` (texto libre), `responsible?` (texto), `dueDate?`, `materials[] {productId, quantityRequired, quantityConsumed}`.

Estados: `DRAFT → RELEASED → IN_PROGRESS ⇄ PAUSED → COMPLETED`; `CANCELLED` desde cualquier no final.
Endpoints: `GET/POST /orders`, `GET/PATCH /orders/:id`, `POST /orders/:id/transition`, `DELETE /orders/:id` (cancela).
Permisos: `production.read/create/update/delete` (transición usa `update`).

**No existe:** BOM y versiones, rutas/operaciones, centros de trabajo, máquinas/líneas como entidades, capacidad, planificación, lotes, desperdicio, consumo real contra inventario, entrada de producto terminado, costeo, KPIs.

### 3.4 Purchasing (`/api/v1/purchasing`)

Entidades: `Supplier` (`suppliers`: code, contacto, email, teléfono, RFC/taxId, estado), `PurchaseOrder` (`purchaseOrders`: folio único, `supplierId`, `lines[] {productId, quantity, unitCost, quantityReceived}`, `subtotal`, `expectedDate`).

Estados OC: `DRAFT → SENT → APPROVED → PARTIALLY_RECEIVED → RECEIVED`; `CANCELLED` desde no finales. La recepción registra `quantityReceived` en la OC.
Endpoints: CRUD de proveedores; `GET/POST /orders`, `GET/PATCH /orders/:id`, `POST /orders/:id/transition` (incluye líneas recibidas), `DELETE /orders/:id`.
Permisos: `purchasing.read/create/update/delete`. **Aprobar y recibir usan `purchasing.update`** (no hay `purchasing.approve` ni `purchasing.receive`; tampoco segregación de funciones).

**No existe:** contactos múltiples, condiciones comerciales, solicitudes de compra, flujo de aprobación, cotizaciones, documento de recepción (la recepción no es un documento propio ni idempotente), **entrada a inventario**, cuentas por pagar, impuestos.

### 3.5 Maintenance (`/api/v1/maintenance`)

Entidades: `Asset` (`assets`: code, nombre, tipo, ubicación, responsable, fechas, `status ACTIVE/IN_MAINTENANCE/OUT_OF_SERVICE/RETIRED`), `MaintenanceOrder` (`maintenanceOrders`: `assetId`, `type PREVENTIVE/CORRECTIVE`, `priority LOW..CRITICAL`, título, descripción, programación, costo, asignado, notas).

Estados OT: `OPEN → IN_PROGRESS ⇄ ON_HOLD → COMPLETED`; `CANCELLED`.
Endpoints: CRUD de activos (DELETE = retiro); `GET/POST /orders`, `GET/PATCH /orders/:id`, `POST /orders/:id/transition` (costo al completar), `DELETE /orders/:id`.
Permisos: `maintenance.read/create/update/delete` (+ `maintenance.assign` definido, sin uso).

**No existe:** planes preventivos/recurrencia, diagnóstico estructurado, repuestos (consumo de inventario), registro de tiempos, fotografías (no hay servicio de documentos/almacenamiento de objetos), cierre con checklist, KPIs (MTBF/MTTR).

### 3.6 HR (`/api/v1/hr`)

Entidades: `Department` (`departments`), `Employee` (`employees`: code, nombre, email, teléfono, `departmentId`, puesto (texto), ubicación, fecha de alta, `userId?` para vincular con usuario, `status ACTIVE/INACTIVE/ON_LEAVE`), `TimeOff` (`timeOffs`: `VACATION/SICK/PERMISSION`, fechas, `PENDING → APPROVED/REJECTED`, `CANCELLED`).

Endpoints: CRUD de departamentos y empleados; `GET/POST /time-off`, `GET /time-off/:id`, `POST /time-off/:id/decision`, `POST /time-off/:id/cancel`.
Permisos: `hr.read.self`, `hr.read.team`, `hr.write.self`, `hr.write`. El alcance "self" se resuelve en servidor vía `employees.userId`.

**No existe:** puestos como catálogo, estructura organizacional, asistencia/checadas, jornadas, incidencias, horas extra, saldo de vacaciones, historial laboral, portal del empleado dedicado. Sin datos de nómina (decisión explícita en el código).

### 3.7 Finance (`/api/v1/finance`)

Entidades: `Account` (`accounts`: code, nombre, `type ASSET/LIABILITY/EQUITY/INCOME/EXPENSE`), `FinanceCategory` (`financeCategories`: `INCOME/EXPENSE`), `FinanceMovement` (`financeMovements`: cuenta, categoría, `kind INCOME/EXPENSE`, monto, método de pago, concepto, referencia, fecha, `status POSTED/VOIDED`).

Endpoints: CRUD de cuentas y categorías (baja bloqueada si hay movimientos); `GET /movements/totals`, `GET/POST /movements`, `GET /movements/:id`, `POST /movements/:id/void` (anulación, no borrado).
Permisos: `finance.read/create/update/delete`.

**Esto es un registro de caja, no contabilidad.** No existen: pólizas/asientos con líneas débito/crédito, regla débitos = créditos, jerarquía de cuentas, periodos y cierres, CxC/CxP, pagos/cobros vinculados a documentos, conciliación, estados financieros, balanza, auxiliares, multimoneda, impuestos.

---

## 4. Catálogo de permisos

Fuente: `apps/api/src/modules/identity/domain/permissions.ts`. El backend es la autoridad; `*` (comodín) se reconoce en API, Web y Mobile.

| Módulo | Definidos | Usados por rutas | Definidos sin uso |
|---|---|---|---|
| Inventario | read, create, update, delete, write, withdraw, transfer, adjust, stock.in, stock.out, stock.adjust | read, create, update, delete | write, withdraw, transfer, adjust, stock.* |
| Producción | read, create, update, delete, write | read, create, update, delete | write |
| Compras | read, create, update, delete, write | read, create, update, delete | write |
| Mantenimiento | read, create, update, delete, assign | read, create, update, delete | assign |
| RRHH | read.self, read.team, write.self, write | todos | — |
| Finanzas | read, create, update, delete | todos | — |
| Sistema | system.users.read, system.users.write | ambos | — |

Brechas frente a lo solicitado: faltan `*.approve`, `*.execute`, `*.cancel`, `*.receive`, `*.close`, `finance.post`. No hay scopes `own/branch/organization`. No hay segregación de funciones (quien crea una OC puede aprobarla y recibirla). El rol `owner` del registro recibe `ALL_PERMISSIONS` en el momento del registro; **permisos nuevos no se propagan automáticamente a owners existentes** (el seed sí sincroniza su rol `admin`). Esto debe resolverse al extender el catálogo.

---

## 5. Navegación

### 5.1 Web (`apps/web/src/navigation/registry.ts` + `routes.tsx`)

Router propio basado en `history.pushState` (react-router-dom está instalado pero no se usa). Sidebar y paleta de comandos se filtran por permisos desde el mismo registro.

| Ruta | Pantalla | Estado |
|---|---|---|
| `/login`, `/register` | Login (empresa+correo+contraseña), Registro | **Real** |
| `/dashboard`, `/` | Dashboard con conteos reales por módulo según permisos | **Real** |
| `/operations/inventory` | Inventario: listar, crear, editar, activar/desactivar | **Real** |
| `/assistant` | Asistente | **Mock** (`setTimeout`) |
| `/operations/warehouses`, `/procurement/purchases`, `/procurement/suppliers`, `/operations/production`, `/operations/maintenance`, `/people/*`, `/finance/*`, `/master-data/*`, `/administration` | `ModulePlaceholder` | **Sin implementar** (la API existe para la mayoría) |
| `/operations/quality`, `/sales/*`, `/analytics`, `/integrations` | `ModulePlaceholder` con `requiredAnyPermissions: []` (nadie los ve salvo `*`) | Sin backend |

`apps/web/src/data/mock.ts` ya no tiene importadores (código muerto).

### 5.2 Mobile (`apps/mobile/src/navigation`)

`RootNavigator` (Login/Register ↔ Main) → `MainTabs` (Inicio, Asistente, Operaciones, Alertas, Más). `OperationsStack` envuelve cada pantalla con `withModulePermission`.

| Módulo | Pantallas | Operaciones contra API |
|---|---|---|
| Inventario | Inventory, ProductForm | listar, crear, editar, activar/desactivar |
| Producción | Production, ProductionOrderForm, ProductionDetail | listar, crear, transicionar, cancelar |
| Compras | Purchasing, SupplierForm, PurchaseOrderForm, PurchaseOrderDetail | proveedores (listar/crear), OC (listar/crear/transicionar con recepción/cancelar) |
| Mantenimiento | Maintenance, AssetForm, MaintenanceOrderForm, MaintenanceOrderDetail | activos (listar/crear/retirar), OT (listar/crear/transicionar/cancelar) |
| RRHH | HR, EmployeeForm, TimeOffForm, TimeOffDetail | empleados (listar/crear/editar), permisos (listar/crear/decidir) |
| Finanzas | Finance, FinanceMovementForm | cuentas/categorías (listar), movimientos (listar/crear/anular), totales |
| Inicio | HomeScreen | KPIs reales (`dashboardApi`) |

**Mock en Mobile:** `data/alerts.ts` (alertas en memoria con datos de ejemplo; 31 llamadas `pushAlert` desde formularios), `AssistantScreen` (respuestas simuladas), `SettingsScreen` (switches sin efecto). `data/dashboard.ts` y `data/production.ts` sin importadores.

Los DTOs de Mobile (excepto inventario y dashboard) están escritos a mano en `apps/mobile/src/lib/api.ts` y no se comparten con la Web ni con la API.

---

## 6. MongoDB

Base: `erp_platform` (Atlas). Colecciones compartidas con `tenantId` (sin colecciones por tenant). Todas las colecciones de negocio heredan `createdBy/updatedBy/createdAt/updatedAt/version`.

| Colección | Índices |
|---|---|
| tenants | `tenantId` único, `slug` único |
| users | `(tenantId,email)` único, `(tenantId,username)` |
| roles | `(tenantId,name)` único |
| memberships | `(tenantId,userId)` único |
| refreshSessions | `sessionId` único, `(tenantId,userId)`, TTL `expiresAt` |
| auditEvents | `(tenantId,createdAt)`, `(tenantId,action,createdAt)` |
| inventoryCategories | `(tenantId,name)` único |
| products | `(tenantId,sku)` único, `(tenantId,barcode)` único parcial, `(tenantId,name)`, `(tenantId,categoryId)` |
| warehouses | `(tenantId,code)` único, `(tenantId,name)` |
| productionOrders | `(tenantId,code)` único, `(tenantId,status)`, `(tenantId,productId)` |
| suppliers | `(tenantId,code)` único, `(tenantId,name)` |
| purchaseOrders | `(tenantId,folio)` único, `(tenantId,supplierId,status)` |
| assets | `(tenantId,code)` único, `(tenantId,name)` |
| maintenanceOrders | `(tenantId,assetId,status)`, `(tenantId,status,priority)` |
| departments | `(tenantId,name)` único |
| employees | `(tenantId,code)` único, `(tenantId,userId)` único parcial, `(tenantId,departmentId)`, `(tenantId,lastName,firstName)` |
| timeOffs | `(tenantId,employeeId,status)` |
| accounts | `(tenantId,code)` único, `(tenantId,type)` |
| financeCategories | `(tenantId,name)` único |
| financeMovements | `(tenantId,accountId,date)`, `(tenantId,kind,date)` |

Índices se crean con `ensureIndexes` al arrancar. No hay sistema de migraciones versionadas. Transacciones (`withTransaction`) solo se usan en el registro de empresa; ningún otro flujo multi-documento es atómico hoy.

---

## 7. Integración entre módulos (estado real)

| Flujo esperado | Hoy |
|---|---|
| Compras → recepción → inventario | La recepción solo actualiza `quantityReceived` en la OC. **No hay entrada de inventario.** |
| Recepción → cuenta por pagar → finanzas | No existe. |
| Producción → consumo → inventario → producto terminado | Consumo y producido se guardan en la orden. **No mueven inventario.** |
| Producción → costos | No existe. |
| Mantenimiento → repuestos → inventario → costos | Costo es un número en la OT; sin repuestos ni asiento contable. |
| RRHH → costos de personal → finanzas | No existe. |
| Compras/Producción → catálogo de productos | **Sí:** validan `productId` contra `products` del mismo tenant. |
| Todos → auditoría | **Sí:** cada caso de uso escribe en `auditEvents`. |
| Eventos de dominio / outbox | No existen. Worker sin jobs. |

---

## 8. Tests

Ejecutado en `65b84d3`: **33 archivos pasan, 5 fallan; 194 tests pasan, 41 omitidos.**

| Tipo | Archivos |
|---|---|
| Unitarios (casos de uso con stores falsos) | identity (hashing, permisos, tokens), register, inventory, production, purchasing, maintenance, hr, finance, config, errors, health, repository, transaction, redis-disabled |
| Contrato | `tests/unit/inventory-client-contract.test.ts` (contrato compartido Web/Mobile vs schemas de la API) |
| Integración API + Mongo en memoria | auth, register, hr, mongo, **web-mobile-inventory-sync** (pasan); inventory, production, purchasing, maintenance, finance (**fallan**) |
| Frontend | `tests/frontend/design-contract.test.ts`, `apps/web` (registry, dashboard), `apps/mobile` (api, dashboard, moduleAccess, sessionEvents) |

**Causa de los 5 fallos (preexistente):** los fixtures crean usuarios en tenants `TENANT_A/TENANT_B` sin crear el documento `tenants`; desde `c9e2b40` el login exige un tenant activo, el login devuelve 401 y el `beforeAll` falla, omitiendo todos los tests del archivo (de ahí los 41 omitidos). Implica que **hoy no hay verificación automática** de aislamiento/permisos de producción, compras, mantenimiento y finanzas a nivel API. Es lo primero a corregir en la Fase 1.

No hay: pruebas E2E de UI (web o móvil), pruebas de carga, pruebas de flujos completos entre módulos.

---

## 9. Despliegue

| Componente | Configuración observada | Verificado |
|---|---|---|
| API | Render, servicio `diplomado-1.onrender.com`, rama `feat/api-auth-mongo`. Build/start: `npm run build` (workspaces en orden) / `node dist/apps/api/src/index.js`. Sin `render.yaml` en el repo (configuración solo en el panel). | Rutas de auth/inventario responden (sondeo sin credenciales). Variables no verificadas desde aquí. |
| API legado | `diplomado-slgd.onrender.com` sigue desplegando `main` (fase Foundation). | Sí. Riesgo de confusión. |
| Web | Cloudflare static assets (`apps/web/wrangler.jsonc`, SPA fallback). `VITE_API_URL` en build. | No verificado (`VITE_API_URL` y dominio no están en el repo). |
| Mobile | Gradle `assembleRelease`, `applicationId com.tramatech.erp`, `versionCode 1`, release **firmado con `debug.keystore`**, `usesCleartextTraffic` vía placeholder. | APK funcional en emulador y teléfono (reportado por el usuario). |
| CI | `.github/workflows/ci.yml` solo en `main/develop` (typecheck, lint, build, test). Fallaría hoy por lint y tests. | Lectura del archivo. |
| Docker | `infrastructure/docker` (API, worker, compose con Mongo/Redis). | No ejecutado. |

---

## 10. Deuda técnica

1. **Fixtures de integración rotos** (5 archivos, ver §8).
2. **Lint en rojo:** 21 errores / 44 advertencias preexistentes (principalmente `no-unused-vars` en web/mobile y tests). CI no puede pasar.
3. **Contratos duplicados:** la API define sus entidades en `domain/`, Mobile y Web reescriben DTOs a mano. Solo inventario y dashboard están en `packages/types`.
4. **`usecases.ts` por módulo** crecerá a archivos monolíticos.
5. **Web sin pantallas** para 5 de 7 módulos con API lista.
6. **Mocks en Mobile:** alertas, asistente, configuración.
7. **OpenAPI incompleto:** falta `/auth/tenant/{slug}`; los schemas no se generan desde Zod (riesgo de divergencia).
8. **Sin migraciones versionadas;** `ensureIndexes` al arranque.
9. **Router Web propio** en lugar de react-router (instalado y no usado).
10. **Listados con `limit=100`** y búsqueda en cliente en Web/Mobile.
11. `packages/config` define `RATE_LIMIT_*` y `ENCRYPTION_KEY` sin uso.
12. Código muerto: `apps/web/src/data/mock.ts`, `apps/mobile/src/data/{dashboard,production}.ts`, `apps/web/src/components/Dashboard.tsx` (sin importadores).

---

## 11. Riesgos

| # | Riesgo | Impacto | Mitigación propuesta |
|---|---|---|---|
| R1 | Sin libro de inventario: compras y producción no afectan existencias | Datos de inventario no confiables para un ERP | Fase 1/2: `inventoryMovements` + saldos materializados, con transacción |
| R2 | Finanzas sin partida doble | No es posible generar estados financieros válidos | Fase 6: rediseño contable antes de pantallas |
| R3 | Sin rate limiting en `/auth/login` y `/auth/register` | Fuerza bruta, creación masiva de tenants | Fase 1 (en memoria; Redis está deshabilitado) |
| R4 | Sin segregación de funciones en aprobaciones | Control interno débil | Permisos `approve/receive` + regla creador ≠ aprobador |
| R5 | Recepción y otras operaciones no idempotentes | Reintentos de red pueden duplicar efectos cuando haya movimientos de inventario | `Idempotency-Key` en operaciones críticas |
| R6 | Owners existentes no reciben permisos nuevos | Al agregar permisos, los dueños actuales quedarían bloqueados | Sincronización de permisos del rol `owner` (migración controlada; **requiere autorización en producción**) |
| R7 | APK release firmado con keystore de debug | No apto para distribución | Keystore de release fuera de Git |
| R8 | Logout con access token expirado no revoca la sesión | Refresh token válido hasta 7 días | Logout aceptando refresh token |
| R9 | Servicio legado `diplomado-slgd` activo | Clientes apuntando a una API sin endpoints | Darlo de baja (**decisión del usuario**) |
| R10 | Integración sin verificación automática para 4 módulos | Regresiones de aislamiento/permiso no detectadas | Corregir fixtures (Fase 1) |
| R11 | Sourcemaps en build de producción Web | Exposición de código fuente | Desactivar o subir a un servicio privado |

---

## 12. Funcionalidad faltante frente al objetivo

| Módulo | Existe | Falta (resumen) |
|---|---|---|
| Comunes | multi-tenant, auth, auditoría, concurrencia optimista | rate limiting, idempotencia, eventos/outbox, numeración de folios, servicio de documentos/archivos, CRUD de roles, permisos granulares nuevos, tipos compartidos |
| Inventario | catálogo, almacenes | **existencias, movimientos, recepciones, salidas, transferencias, ajustes, lotes, tipos de producto, UOM**, valuación |
| Compras | proveedores, OC con estados y recepción en la OC | contactos, condiciones, solicitudes, aprobaciones, cotizaciones, documento de recepción, entrada a inventario, CxP, Web |
| Producción | órdenes con materiales y estados | centros de trabajo, máquinas, líneas, operaciones, rutas, BOM/versiones, planificación, capacidad, consumo real, lotes, desperdicio, costeo, KPIs, Web |
| Mantenimiento | activos, OT preventiva/correctiva | planes, diagnóstico, repuestos, tiempos, fotos, cierre, KPIs, Web |
| RRHH | departamentos, empleados, permisos/vacaciones | puestos, organigrama, asistencia, jornadas, incidencias, horas extra, saldos, portal, historial, Web |
| Finanzas | cuentas, categorías, movimientos de caja | modelo contable completo (pólizas, partida doble, periodos, CxC/CxP, pagos, conciliación, estados financieros), Web |

---

## 13. Plan propuesto (siguiente paso: Fase 1)

**Fase 1 — Fundaciones comunes** (sin módulos nuevos de negocio):

1. Corregir los fixtures de los 5 tests de integración (crear el tenant en `beforeAll`) para recuperar la red de seguridad. No se cambian expectativas.
2. Dejar lint en verde (errores triviales de variables sin uso) para que CI pueda ejecutarse.
3. `packages/types`: contratos comunes (paginación, envelope, errores, estados) y migrar progresivamente los DTOs de Mobile/Web, empezando por compras (patrón de `inventory.ts`).
4. Extender el catálogo de permisos (`approve`, `receive`, `execute`, `close`, `cancel`, `post`) **manteniendo los actuales** y mecanismo de sincronización de permisos para roles `owner` (aditivo; en producción solo con autorización).
5. Rate limiting en memoria para `/auth/*`.
6. Base de idempotencia (`Idempotency-Key`) y helper de transacciones para casos de uso multi-documento.
7. **Libro de inventario mínimo** (`inventoryMovements` + saldos por producto/almacén) como fundación compartida que Compras (Fase 2), Producción (Fase 3) y Mantenimiento (Fase 4) necesitan.

Cada paso: cambio pequeño → typecheck → tests → build web → bundle móvil → commit propio.

**Fase 2 — Compras + inventario:** recepción como documento idempotente que genera entradas al libro de inventario; permisos `purchasing.approve/receive` con segregación; pantallas Web (proveedores, OC, recepción) y flujo de recepción móvil; test de flujo completo proveedor → OC → aprobación → recepción → inventario. CxP se deja preparada para Finanzas (Fase 6), no se simula.

---

## 14. Fase 1 — Fundaciones comunes (completada)

| Paso | Resultado | Commit |
|---|---|---|
| Fixtures de integración | Los 5 archivos que fallaban (41 tests omitidos) ahora corren y pasan; aserciones sin cambios | `test: create tenant documents…` |
| Lint en verde | 0 errores (44 advertencias `no-explicit-any`/`no-console`); CI puede ejecutarse | `chore: clear lint errors…` |
| Permisos compartidos y granulares | Catálogo en `packages/types/src/permissions.ts` (API lo reexporta). Nuevos: `production.approve/execute/cancel`, `purchasing.approve/receive/cancel`, `maintenance.execute/close`, `hr.approve`, `finance.post/approve`. Script de sincronización aditiva `roles:sync-permissions` (simulación por defecto) | `feat(identity): share permission catalog…` |
| Rate limiting de auth | Login por cuenta e IP, registro por IP, consulta de empresa/refresh por IP; `trust proxy` = 1 en producción | `feat(identity): rate-limit public auth endpoints` |
| Reintento de transacciones | `mapMongoError` ya no oculta `TransientTransactionError` (antes: 500 en concurrencia) | `fix(database): …` |
| Libro de inventario | Movimientos inmutables, saldos, transferencias, idempotencia, transacción única — ver `docs/modules/inventory.md` | `feat(inventory): add stock ledger…` |
| UI Web/Mobile de existencias | Web `/operations/warehouses`; Mobile Existencias + captura rápida | `feat(inventory): add stock screens…` |
| Web | `createRoot` en lugar de `hydrateRoot` (errores de hidratación en cada carga) | `fix(web): …` |
| OpenAPI | Endpoints nuevos y `/auth/tenant/{slug}` documentados; test de contrato que falla si un router expone una ruta no documentada | `docs(api): …` |

**Estado de calidad al cierre:** 44 archivos / 264 tests pasan, 0 omitidos; typecheck sin errores en todos los workspaces; lint sin errores; build completo del monorepo OK; bundle Android (Metro) OK.

**Verificación manual:** Web local contra la API real con MongoDB en memoria (sin tocar Atlas): login por empresa, existencias, salida rechazada por stock insuficiente con mensaje en español y sin escritura, salida válida que actualiza saldo e historial.

### Riesgos actualizados

| # | Estado |
|---|---|
| R1 (sin libro de inventario) | **Mitigado**: libro disponible; falta conectarlo a Compras/Producción/Mantenimiento (Fases 2–4) |
| R3 (sin rate limiting) | **Mitigado** (en memoria, por instancia) |
| R5 (operaciones no idempotentes) | **Mitigado para inventario**; patrón reutilizable (`apps/api/src/shared/idempotency.ts`) |
| R6 (owners sin permisos nuevos) | **Herramienta lista**: `npm run roles:sync-permissions --workspace @erp/api` (simulación) y `-- --apply`. **En producción requiere autorización explícita.** Ninguna ruta exige todavía los permisos nuevos |
| R10 (integración sin verificación) | **Resuelto** |

### Acciones de despliegue pendientes (requieren tu decisión)

1. Push de la rama → Render redespliega la API (crea colecciones e índices nuevos al arrancar: `inventoryMovements`, `inventoryBalances`, `idempotencyKeys`; aditivo, no modifica datos existentes).
2. Ejecutar en producción, cuando lo autorices, `roles:sync-permissions` primero en simulación y después con `--apply`.
3. Recompilar el APK para incluir las pantallas de existencias.
4. Nueva deuda detectada: `.js/.d.ts` generados versionados dentro de `packages/{database,errors,logger}/src` (el runtime usa `dist/`); conviene retirarlos de Git en una limpieza dedicada.
