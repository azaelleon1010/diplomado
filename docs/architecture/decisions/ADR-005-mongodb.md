# ADR-005 — MongoDB Atlas Connection & Persistence

**Status:** Accepted  
**Date:** 2026-09-23  
**Context:** Foundation ya tenía `apps/api/src/db/mongo.ts` con mongoose directo, pero sin capa Infrastructure clara, sin lifecycle estricto, sin repository base, sin manejo de pool/timeout configurables, sin health `/health/db`, y con posible duplicación si futuros módulos crearan su propio `MongoClient`. AGENTS.md exige Atlas como SOR y una sola capa responsable.

**Decision:**
- ODM único: `mongoose` 8.9 (ya presente, estable, soporta optimisticConcurrency, transactions, TS). No añadir `mongodb` nativo paralelo.
- Nueva capa `packages/database` (compartido) con: `connection.ts` (singleton pool, redactUri, buildOptions de `@erp/config`), `health.ts`, `errors.ts` (`mapMongoError`), `base.ts` (tenant fields), `repository.ts` (BaseRepository con tenantFilter), `transaction.ts` (`withTransaction`), `indexes.ts` (catalog).
- `apps/api/src/infrastructure/database/mongodb` re-exporta `@erp/database` para cumplir `Presentation→Application→Domain→Infrastructure` sin mover toda la lógica fuera de `apps/api`.
- `apps/api/src/db/mongo.ts` queda como compat shim delegando a `@erp/database` — evita duplicar conexiones.
- Config centralizada `@erp/config` valida `MONGODB_URI`, `MONGODB_DATABASE` (canónico) + alias `MONGODB_DB_NAME`, pool sizes y timeouts vía `zod` + `__resetConfigForTests` para tests.
- Lifecycle: `Load Config → Validate → Connect → Verify → Start HTTP`; en prod failure es fatal, en dev/test degraded con warn.
- Graceful shutdown unificado para HTTP+Mongo+Redis.
- Health: añade `GET /health/db` y mantiene `/health`, `/live`, `/ready`.

**Alternatives Considered:**
- `mongodb` native driver sin Mongoose: más ligero pero sin schemas, sin versioning built-in, mayor costo para futuros módulos ERP. Rechazado.
- Añadir `Prisma`/`TypeORM`: no Mongo nativo, abstracción innecesaria. Rechazado.
- Múltiples `MongoClient` por módulo: prohibido — un solo pool.

**Consequences:**
- Todos los módulos futuros usan `BaseRepository` y `withTransaction`; ningún `mongoose.connect` fuera de `@erp/database`.
- Índices y transacciones preparados para Finance/Inventory.
- Tests con `mongodb-memory-server` y `MongoMemoryReplSet` cubren lifecycle, tenant isolation, duplicate, version, transactions sin necesitar Atlas real en CI.
- Riesgo: `mongoose` es pesado; se asume que el equipo lo conoce. Mitigado con wrapper fino y no exponer detalles a Domain.
