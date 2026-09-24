# Arquitectura objetivo — ERP Platform

**Estado:** propuesta vigente, refinada tras auditoría 2026-09-23  
**Principio:** modular monolith que pueda extraer módulos a servicios sin reescribir.

## 1. Forma del sistema

```
React Native / RN Web (TS)  — apps/web, apps/mobile (Fase 3+)
          ↓ REST /api/v1 + OpenAPI
      API modular (Express 5, TS)
          ↓
  Application → Domain → Infrastructure
          ↓                ↓
   Eventos/Outbox      MongoDB Atlas (SOR)
          ↓
     Redis + BullMQ → Worker (async)
```

MongoDB es System of Record. Redis solo para colas, cache, locks, rate limiting, idempotencia temporal.

## 2. Organización (monorepo)

```
erp-platform/
├── apps/api, apps/worker, apps/web, apps/mobile
├── modules/identity, organization, master-data, finance, sales, ... (Fase 2+)
├── packages/types, validation, logger, errors, config, permissions, ui, ...
├── infrastructure/docker, ci, monitoring
├── tests/unit, integration, e2e, performance
├── docs/architecture, api, database, qa, security, business
└── pnpm-workspace.yaml + package.json workspaces (npm compat)
```

Cada módulo ERP separa `domain/ application/ infrastructure/ presentation/ tests/` — controllers no contienen reglas de negocio.

## 3. Límites y flujos

- API versionada `/api/v1`, valida auth → tenant → permisos → payload → reglas → transacción → eventos → respuesta.
- Documentos empresariales llevan al menos `tenantId`, `organizationId`, `branchId`, `createdBy/At`, `version` (optimistic concurrency).
- Colecciones compartidas con `tenantId`; índice siempre incluye `tenantId`. Repositorios imponen `findOne({ _id, tenantId })`, no `find({ _id })`.
- Finanzas: `JournalEntry`/`JournalLine` con `TOTAL_DEBITS = TOTAL_CREDITS`, estados DRAFT→POSTED→RECONCILED, correcciones vía reversal.
- Inventario: `InventoryMovement` ledger + balances materializados, trazable a documento origen.
- Eventos: Domain Events + Outbox pattern (transacción business+outbox), workers con reintentos idempotentes (`Idempotency-Key`).
- Archivos: metadata en Mongo, binarios en object storage.
- AI/RAG: con `tenantId` y permisos; nunca bypass.

## 4. Seguridad

- RBAC granular (`sales.order.approve`) + ABAC por scope (own/branch/org/global).
- Helmet, CORS, rate limiting, Zod validation, audit trail (userId, tenantId, before/after, traceId).
- Secretos vía `.env` local, nunca en Git; `JWT_SECRET` validado en prod.

## 5. Observabilidad

- `traceId`/`requestId` por request, `pino` structured logs filtrables por tenant/module/action.
- Health: `/health/live` (liveness), `/health/ready` (dependencias), `/health` (degraded logic). OpenAPI en `/api/v1/openapi.json`.

## 6. Frontend / Mobile

- React Native + RN Web + TS; shared types, validation, api-client, permissions.
- Design System central (Button, Table, KPI, etc.), UX por rol.
- Offline selectivo con sync queue y conflict resolution; finanzas con políticas explícitas.
- Kotlin solo para hardware (RFID/NFC/BT).

## 7. Calidad y evolución

- Unit / integration / contract / E2E / tenant-isolation / concurrency / idempotency.
- CI: typecheck → lint → build → test → health probe.
- ADRs en `docs/architecture/decisions/` (001 monolith, 002 multi-tenancy, 003 Node, 004 workspaces, 005 ledger, etc.).
- Roadmap Fase 0→14 (ver `roadmap.md`).

## 8. Decisiones por implementar en Fase 1

Ver `foundation-plan.md`: TypeScript strict, Express, Mongoose, ioredis, BullMQ, pino, vitest, supertest, helmet/cors/compression, dotenv+zod config, Docker (node:22-alpine), GitHub Actions.
