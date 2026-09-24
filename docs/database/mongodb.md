# MongoDB Atlas — Infraestructura de Persistencia

**System of Record:** MongoDB Atlas  
**Capa:** `packages/database` (compartido) → `apps/api/src/infrastructure/database/mongodb` (re-export) → `apps/api/src/db/mongo.ts` (compat)  
**Driver/ODM:** `mongoose` 8.9 (única estrategia; no se añadió segundo driver)

## 1. Arquitectura

```
Presentation (routes/controllers)
      ↓
Application (use cases, handlers)
      ↓
Domain (entities, rules)
      ↓
Infrastructure (@erp/database)  ← single pool
      ↓
MongoDB Atlas
```

* Business modules usan `BaseRepository<T>` — nunca `mongoose` directo.
* `@erp/database` expone: `connectMongo`, `disconnectMongo`, `pingMongo`, `withTransaction`, `mapMongoError`, `BaseRepository`, `ensureIndexes`, `baseFields`.

Ver `docs/architecture/decisions/ADR-005-mongodb.md`.

## 2. Connection Lifecycle

```
Load Config (zod) → Validate → Connect MongoDB → Verify (ping) → Start HTTP
       ↓ fail fast in production                ↓ degraded in dev/test
```

* **Singleton:** `connecting` promise evita doble `mongoose.connect`. Estado `connected` + `readyState`.
* **Pool:** `maxPoolSize=10`, `minPoolSize=2`, `serverSelectionTimeoutMS=5000`, `socketTimeoutMS=45000`, `maxIdleTimeMS=30000` (configurables vía env, documentados en `.env.example`).
* **TLS:** Atlas `mongodb+srv://` negocia TLS automáticamente; no se deshabilita.
* **Retry:** `retryWrites/retryReads=true` (driver).
* **Observabilidad:** logs `MongoDB connecting/connected/reconnected/error/disconnected` con `traceId`, categoría/código técnico de error y sin URI, usuario ni password.
* **Verificación:** `pingMongo()` hace `db.admin().ping()` + `latencyMs`.

## 3. Graceful Shutdown

`SIGTERM/SIGINT/uncaughtException/unhandledRejection` → `server.close()` → `Promise.allSettled([disconnectMongo(), disconnectRedis()])` → exit. Timeout 10s fuerza salida. `shuttingDown` flag evita doble cierre.

## 4. Health Checks

* `GET /api/v1/health` → `{ status: ok|degraded|down, dependencies: { mongodb, redis } }` (503 si `down`)
* `GET /api/v1/health/live` → liveness
* `GET /api/v1/health/ready` → `ready=true` solo si mongo y redis `ok`
* `GET /api/v1/health/db` / `GET /health/db` → solo MongoDB (nuevo, cumple requisito `/health/db`)

Todos incluyen `traceId`; nunca exponen URI/creds.

## 5. Multi-Tenancy

* Todo doc empresarial lleva al menos `tenantId` (ver `packages/database/src/base.ts`).
* `BaseRepository.tenantFilter(ctx)` impone `tenantId` en cada query; sin `tenantId` lanza.
* Índices compuestos `tenantId` primero. Ej.: `findOne({ _id, tenantId })` usa `{ tenantId:1, _id:1 }`.
* Preparado para `organizationId/legalEntityId/branchId/locationId` cuando Identity lo provea — no se inventa auth aquí.

## 6. Repository Pattern

```ts
class CustomerRepo extends BaseRepository<Customer> {
  constructor() { super(CustomerModel); }
}
await repo.create({ code:'C001', name:'Acme' }, ctx);
await repo.findById(id, ctx);
await repo.updateById(id, patch, ctx, expectedVersion);
```

* Business depende de abstracción `BaseRepository`; infraestructura provee implementación Mongo.
* `deleteById` bloquea hard-delete (FERP requiere soft-delete).

## 7. Indexes

Ver `packages/database/src/indexes.ts`:

* Base: `{tenantId:1,_id:1}`, `{tenantId:1,createdAt:-1}`, `{tenantId:1,status:1,createdAt:-1}`
* Futuros: `customers {tenantId:1,code:1} unique`, `products {tenantId:1,sku:1} unique`, `inventoryMovements {tenantId:1,productId:1,warehouseId:1}`, `journalEntries {tenantId:1,status:1,postedAt:-1}`

Documentados con `reason` y `queryPattern`; se aplican vía `schema.index()` + `syncIndexes()` (auto en dev).

## 8. Transactions

```ts
await withTransaction(async (session) => {
  await invoiceRepo.create(inv, ctx, session);
  await journalRepo.create(entry, ctx, session);
});
```

* Usa `client.startSession().withTransaction()`, `w:majority`. Preparado para `invoice+journal`, `inventory+movement+reservation`, etc.
* No envolver todo automáticamente.

## 9. Validación & Errores

* App validation con `zod` antes de persistir.
* `mapMongoError` convierte: `E11000→409 CONFLICT`, `ValidationError→400`, `CastError→400`, `VersionError→409 VERSION_CONFLICT`, `ServerSelectionTimeout→503`.
* Nunca se devuelve stack/E11000 crudo al cliente; formato estándar `{success:false, error:{code,message,fields}, traceId}`.

## 10. Environment Variables

| Variable | Default | Requerido |
|----------|---------|-----------|
| `MONGODB_URI` | — | Sí; debe proporcionarse por environment (Atlas `mongodb+srv://` en producción) |
| `MONGODB_DATABASE` (canónico) / `MONGODB_DB_NAME` (alias) | `erp_platform` | — |
| `MONGODB_MAX_POOL_SIZE` | `10` | — |
| `MONGODB_MIN_POOL_SIZE` | `2` | — |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `5000` | — |
| `MONGODB_SOCKET_TIMEOUT_MS` | `45000` | — |
| `MONGODB_MAX_IDLE_TIME_MS` | `30000` | — |

Ver `.env.example` completo. Validación `zod` al arrancar; mensaje claro si falta `MONGODB_URI`.

## 11. Local Development

```bash
cp .env.example .env
# editar MONGODB_URI (Atlas o local)
npm install
npm run build
npm run dev --workspace=@erp/api
curl http://localhost:3000/api/v1/health/db
```

Docker: `infrastructure/docker/docker-compose.yml` inyecta `MONGODB_URI= mongodb://erp:...@mongodb:27017/...` vía env, sin hardcodear creds en Dockerfile.

## 12. Testing

* `mongodb-memory-server` para tests aislados (no toca producción).
* Suites: `config-mongo`, `mongo` (lifecycle), `repository` (tenant isolation, duplicate, version), `transaction` (commit/rollback con replSet), `health-mongo`.

## 13. Production Considerations

* TLS obligatorio (Atlas lo negocia).
* `autoIndex=false` en prod — índices vía migraciones/`syncIndexes()` controlado.
* Pool sizing documentado; no sobre-provisionar.
* Monitoring: `pingMongo` latency, `connectionState`, logs estructurados.
* No `dropDatabase()` en tests contra Atlas.
