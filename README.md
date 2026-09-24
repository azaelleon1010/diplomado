# ERP Platform — Foundation

> Modular monolith ERP — multi-tenant, auditable, event-driven, AI-ready. Fase 1 Foundation.

## Stack

- Node.js 22 LTS, TypeScript 5.7, Express 5
- MongoDB Atlas (system of record), Redis + BullMQ (queues/cache)
- React Native + React Native Web (previsto Fase 2+)
- Vitest, ESLint, Prettier, OpenAPI 3.0

## Estructura

```
apps/api        -> API REST versionada (/api/v1)
apps/worker     -> BullMQ worker (emails, PDFs, imports, IA)
packages/*      -> logger, errors, types, config (compartidos)
modules/*       -> placeholder para dominios ERP (Fase 2+)
infrastructure/ -> Docker, CI, monitoring
tests/          -> unit / integration / e2e
docs/           -> architecture, api, database, qa, security
```

Ver `docs/architecture/*` para decisiones y roadmap.

## Quick start

```bash
cp .env.example .env
npm install
npm run build
npm run dev      # api en :3000
# en otra terminal
npm run dev --workspace=@erp/worker
```

Docker (requiere Docker Desktop):

```bash
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

## Health

- `GET /api/v1/health`       -> dependencias (Mongo, Redis) + latencias
- `GET /api/v1/health/live`  -> liveness
- `GET /api/v1/health/ready` -> readiness
- `GET /api/v1/openapi.json` -> OpenAPI spec

## API conventions

- Versionada: `/api/v1/...`
- Errores estructurados: `{ success:false, error:{code,message,fields}, traceId }`
- Éxito: `{ success:true, data, meta, traceId }`
- Trazabilidad: `x-trace-id` / `x-request-id` propagados y loggeados (pino structured)
- Validación con Zod, tenantId obligatorio encolecciones multi-tenant (Fase 2)

## Scripts

| comando | efecto |
|--------|--------|
| `npm run typecheck` | tsc --noEmit |
| `npm run lint` | eslint |
| `npm test` | vitest run |
| `npm run build` | compila workspaces |

## Seguridad

- No commitear `.env`; usar `.env.example`
- helmet, cors, rate-limit (previsto), validación estricta
- Ningún secreto hardcodeado; `JWT_SECRET` obligatorio en producción

## Roadmap

Ver `docs/architecture/roadmap.md`. Foundation completa -> siguiente Fase 2 Identity (auth, RBAC, tenant isolation, audit).
