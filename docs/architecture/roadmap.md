# Hoja de ruta — ERP Platform

**Actualizado:** 2026-09-23 tras auditoría real

## Fase 0 — Descubrimiento ✓ completada

- Inspección de árbol, versiones (Node 24.15, npm 11.13, sin pnpm/docker), git, env, docs.
- Generados `current-state.md`, `target-state.md`, `roadmap.md`, `AGENTS.md` vigente.
- Sin pruebas que ejecutar (repo vacío).

## Fase 1 — Foundation (validación de conectividad en curso)

**Objetivo:** base técnica arrancable, probada y observable antes de cualquier módulo ERP.

- [x] Plan ejecutable (`foundation-plan.md`)
- [x] Monorepo npm workspaces + pnpm-workspace.yaml compat, `tsconfig.base.json`, ESLint, Prettier, `.env.example`
- [x] Packages: `@erp/config` (zod+dotenv), `@erp/logger` (pino), `@erp/errors` (AppError), `@erp/types`
- [x] `apps/api`: Express 5, helmet/cors/compression, trace/requestLogger, errorHandler, `/health*`, `/openapi.json`, Mongo/Redis clients (degraded mode), `pino` logs, `traceId` propagado
- [x] `apps/worker`: BullMQ + ioredis (placeholder queue)
- [x] Testing: Vitest + Supertest (unit), `vitest.config.ts`
- [x] Docker: `Dockerfile.api`, `Dockerfile.worker`, `docker-compose.yml` (node:22-alpine, mongo:7, redis:7)
- [x] CI: `.github/workflows/ci.yml` (Node 22, mongo+redis services, typecheck/lint/build/test/health)
- [x] `npm install`, `build`, `typecheck` y pruebas ejecutadas correctamente
- [x] Lint ejecutado sin errores (warnings preexistentes no bloqueantes)
- [ ] Conexión Atlas real: bloqueada por `ECONNREFUSED` del entorno actual

**Salida parcial:** la Foundation compila y la suite local pasa; el health endpoint responde de forma degradada cuando MongoDB/Redis no están disponibles. La conectividad Atlas debe repetirse desde una red con acceso al cluster.

## Fase 2 — Identity

Auth JWT, users, tenants, roles/permissions granulares, sessions, MFA scaffold, tenant isolation middleware, `tenantId` enforcement + tests Tenant A→B (403/404), audit trail.

## Fase 3 — Master Data

Customers, suppliers, products, categories, UOM, taxes, warehouses/locations — CRUD, Zod, audit, permisos, índices, tenant isolation tests.

## Fases 4-7 — Sales, Purchasing, Inventory/WMS, Finance

Flujos completos con ledger contable/inventario, idempotencia (`Idempotency-Key`), concurrency (`version`), closed-period, traceability.

## Fase 8 — Workflow/Events

Workflow engine, approvals, rule engine, Outbox, workers, notifications.

## Fase 9 — Reporting

Dashboards, KPIs, drill-down, exports, permisos por scope.

## Fase 10+ — Manufacturing, Service/Assets/Projects, AI, Mobile/Offline, Industry Packs

Ver `AGENTS.md` §66. No iniciar antes de Foundation+Identity validados.

## Criterios de avance por fase

Cada fase requiere: objetivo, actor, casos +/-, permisos, datos, API, aceptación + tests (unit/integration/contract/E2E/tenant/concurrency/idempotency) + docs + ADR si cambia arquitectura.
