# Módulo de Inventario

**Estado:** catálogo (fase previa) + libro de inventario (Fase 1).
**Código:** `apps/api/src/modules/inventory`, contrato compartido `packages/types/src/inventory.ts`.

## Propósito

Ser la única fuente de verdad de productos, almacenes y existencias del tenant. Las existencias **no son un número editable**: son la proyección de un libro de movimientos inmutable. Compras (recepciones), Producción (consumos y producto terminado) y Mantenimiento (repuestos) escribirán existencias solo a través de este libro.

## Entidades

| Entidad | Colección | Notas |
|---|---|---|
| Category | `inventoryCategories` | `ACTIVE/INACTIVE`; no se desactiva con productos activos |
| Product | `products` | SKU único por tenant, `trackInventory`, stock mín./máx. |
| Warehouse | `warehouses` | código único por tenant |
| StockMovement | `inventoryMovements` | **append-only**: nunca se edita ni se borra |
| StockBalance | `inventoryBalances` | saldo materializado único por `(tenant, producto, almacén)` |
| Idempotency key | `idempotencyKeys` (compartida) | TTL 7 días; única por `(tenant, scope, key)` |

### StockMovement

`postingId` (agrupa las líneas de una operación), `productId`, `warehouseId`, `type`, `direction` (`IN/OUT`), `quantity` (> 0, máx. 3 decimales), `unitCost?`, `balanceAfter`, `source {type, id?, reference?}`, `notes?`, `createdBy`, `createdAt`.

| Tipo | Dirección | Origen |
|---|---|---|
| `RECEIPT` | IN | manual (luego: recepción de compra) |
| `ISSUE` | OUT | manual |
| `ADJUSTMENT_IN` / `ADJUSTMENT_OUT` | IN / OUT | manual (conteos, mermas) |
| `TRANSFER_OUT` + `TRANSFER_IN` | OUT + IN | transferencia (misma posting) |

`source.type`: `MANUAL`, `TRANSFER`; reservados para fases siguientes: `PURCHASE_RECEIPT`, `PRODUCTION_ORDER`, `MAINTENANCE_ORDER`.

## Reglas de negocio

1. **Atomicidad:** saldos, movimientos, llave de idempotencia y evento de auditoría se escriben en **una transacción** MongoDB. Si una línea falla, no se escribe ninguna.
2. **Sin saldo negativo:** la salida es una actualización condicional (`quantity >= q`). Con concurrencia, los conflictos de escritura se reintentan dentro de la transacción; el resultado nunca sobregira.
3. **Idempotencia:** `idempotencyKey` obligatorio (8–128 caracteres). Reintento con la misma llave y mismo contenido → misma respuesta (`replayed: true`, HTTP 200). Misma llave con otro contenido → `409 IDEMPOTENCY_CONFLICT`.
4. Producto `ACTIVE` y con `trackInventory = true`; almacén `ACTIVE`.
5. Correcciones = nuevo movimiento contrario. No existe edición ni borrado de movimientos.
6. Invariante verificada en tests: **saldo = suma con signo de sus movimientos**.

## Permisos

| Operación | Permiso |
|---|---|
| Ver existencias / movimientos | `inventory.read` |
| Entrada (`RECEIPT`) | `inventory.stock.in` |
| Salida (`ISSUE`) | `inventory.stock.out` |
| Ajustes | `inventory.stock.adjust` |
| Transferencia | `inventory.transfer` |
| Crear / editar / desactivar catálogo | `inventory.create` / `inventory.update` / `inventory.delete` |

La ruta `POST /movements` exige al menos uno de los permisos de stock y el caso de uso valida el permiso **de cada línea** con los permisos resueltos en servidor. Los módulos que integren el libro (p. ej. Compras) se autorizan con su propio permiso (`purchasing.receive`) e invocan `postStockMovements` dentro de su transacción.

## Endpoints (`/api/v1/inventory`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/stock?productId&warehouseId&nonZero&page&limit` | Saldos |
| GET | `/movements?productId&warehouseId&type&sourceType&sourceId&postingId&page&limit` | Movimientos (más recientes primero) |
| POST | `/movements` | `{ lines[], reference?, notes?, idempotencyKey }` |
| POST | `/transfers` | `{ productId, fromWarehouseId, toWarehouseId, quantity, reference?, notes?, idempotencyKey }` |
| CRUD | `/categories`, `/products`, `/warehouses` | Catálogo (PATCH con `expectedVersion`, DELETE = baja lógica) |

Errores de negocio: `INSUFFICIENT_STOCK` (409, `fields.available/requested`), `IDEMPOTENCY_CONFLICT` (409), `VALIDATION_ERROR` (400), `NOT_FOUND` (404, incluye recursos de otro tenant).

## Pantallas

| Plataforma | Pantalla | Capacidades |
|---|---|---|
| Web | `/operations/inventory` | Catálogo de productos: crear, editar, activar/desactivar |
| Web | `/operations/warehouses` | KPIs, filtro por almacén, búsqueda, existencias con alerta de stock mínimo, historial, registrar movimiento, transferir, crear almacén |
| Mobile | Inventario | Catálogo + acceso a Existencias |
| Mobile | Existencias | Saldos por producto, chips por almacén, últimos movimientos, pull-to-refresh |
| Mobile | Movimiento de inventario | Captura rápida: tipo con botones grandes, selector con búsqueda, saldo actual, confirmación en salidas, "Registrar otro" |

Ambas plataformas usan el mismo contrato (`createInventoryApi`, `createStockApi`), los mismos mensajes de error de negocio (`describeStockError`) y la misma regla de cantidades (`parseStockQuantity`). La llave de idempotencia se conserva mientras el formulario no cambie, así que reintentar después de un fallo de red no duplica el movimiento.

## Tests

| Archivo | Cubre |
|---|---|
| `tests/integration/inventory-ledger.test.ts` | Entrada, idempotencia, rechazo y rollback atómico, decimales, transferencias, concurrencia (5 salidas paralelas → exactamente las que caben), invariante de saldo, permisos por tipo, aislamiento entre tenants, auditoría |
| `tests/integration/web-mobile-inventory-sync.test.ts` | Dos clientes (web/mobile) por el contrato compartido: catálogo y existencias sincronizados vía API + MongoDB |
| `tests/unit/inventory-client-contract.test.ts` | Rutas/métodos exactos del contrato, validación, parsing de cantidades |
| `tests/unit/mongo-errors.test.ts` | Los conflictos transitorios llegan a `withTransaction` para reintentarse |

## Decisiones

- **Libro + saldo materializado** en lugar de recalcular agregando movimientos: lecturas O(1) por producto/almacén y trazabilidad completa.
- **Idempotencia en el cuerpo** (`idempotencyKey`) y no en un header: contrato explícito y validado por Zod igual que el resto del payload; los clientes no necesitan soporte de headers personalizados.
- **Sin Redis:** la idempotencia vive en MongoDB dentro de la misma transacción que los datos (Redis está deshabilitado y no debe ser fuente de verdad).

## Pendiente (fases siguientes)

Lotes/series, ubicaciones (bins), valuación de costo (promedio), conteos cíclicos, UOM como catálogo, entradas por recepción de compras (Fase 2), consumos/producto terminado (Fase 3), repuestos (Fase 4).
