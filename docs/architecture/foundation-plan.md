# Foundation Plan — ejecutable

**Objetivo:** base técnica mínima pero completa según AGENTS.md §58 / Phase 1

## Alcance incluido

- Monorepo: `package.json` workspaces (`apps/*`, `packages/*`) + `pnpm-workspace.yaml` para compat
- TypeScript 5.7 strict, `tsconfig.base.json` compartido
- Lint (ESLint 9 + @typescript-eslint) + Prettier + EditorConfig + .gitignore
- Env: `dotenv` + `zod` validación en `@erp/config`, `.env.example`, `JWT_SECRET` check en prod
- Logging: `@erp/logger` con `pino` + `pino-pretty` (dev), `traceId`/`requestId`/`tenantId` context, `redactSecrets`
- Errors: `@erp/errors` con `AppError` y helpers, formato `{success:false, error:{code,message,fields}, traceId}`
- API (`apps/api`): Express 5, helmet, cors, compression, `traceMiddleware`, `requestLogger`, `errorHandler`, `createApp()` testeable
- Rutas: `GET /`, `GET /api/v1/openapi.json`, `GET /health*` (live/ready con ping Mongo/Redis + latencias), 404 estructurado
- OpenAPI: `openapi.ts` (3.0.3) con health + system tags, securitySchemes bearer
- DB: `packages/database` (Mongoose connect/disconnect/ping, pool único y errores clasificados), `apps/api/src/db/redis.ts` (ioredis, prefix, ping)
- Worker (`apps/worker`): BullMQ + ioredis, queue placeholder, shutdown hooks
- Testing: `vitest.config.ts`, `tests/unit/{health,config,errors}.test.ts` con Supertest, coverage v8
- Docker: `Dockerfile.api`/`Dockerfile.worker` (node:22-alpine), `docker-compose.yml` (mongo:7, redis:7, api, worker)
- CI: `.github/workflows/ci.yml` (Node 22, services mongo/redis, ci/typecheck/lint/build/test/health)
- Docs: `README.md`, ADRs iniciales

## Alcance excluido (no hacer en esta fase)

Manufacturing, HR/Payroll, AI Agents, Industry Packs, master-data/sales/etc. Solo scaffolding placeholder.

## Orden de implementación

1. `packages/*` primero (config/logger/errors/types) — sin dependencias cruzadas de app
2. `apps/api` y `apps/worker`
3. `tests/unit` + `vitest.config`
4. `infrastructure/docker` + `.github/workflows`
5. `npm install` → fix tipos → `npm run typecheck` → `npm run lint` → `npm run build` → `npm test`

## Validación (comandos reales, no afirmaciones)

```bash
npm install
npm run typecheck
npm run lint
npm run build   # workspaces
npm test        # vitest run
# health manual:
npm run dev --workspace=@erp/api & curl http://localhost:3000/api/v1/health/live
```

Criterio DONE: todos pasan, health responde con traceId, sin secretos, sin TODOs críticos.

## Riesgos y mitigaciones

- Sin pnpm en host → usar npm workspaces, mantener pnpm yaml
- Sin Docker local → validar build, CI valida compose
- Node 24 local vs 22 Docker → engines >=20 <25, CI 22
- Pino-pretty faltante en prod → solo activar en !production
- Atlas inaccesible desde una red local → health devuelve 503 y la causa técnica se registra sin secretos; `MONGODB_URI` no tiene fallback hardcodeado
- Mongo/Redis caídos → API arranca degradada, health refleja `degraded`/`down`

## Próximos pasos (Fase 2)

Tras validar Foundation: `git init`, ADRs, Identity con tenant isolation tests.
