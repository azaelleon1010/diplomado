# ADR-004 — Logging y Observabilidad

**Status:** Accepted
**Date:** 2026-09-23

**Decision:** `pino` + `pino-http` (structured JSON en prod, `pino-pretty` en dev) con campos `traceId`, `requestId`, `tenantId`, `userId`, `module`, `action`, `duration`, `status`. `traceMiddleware` genera `x-trace-id`/`x-request-id`. `requestLogger` mide duración y loggea por status. Health endpoints con `pingMongo`/`pingRedis` + latencias.

**Rationale:** Pino es más rápido que Winston, soporta redacción de secretos; traceId correlaciona API→Worker→DB.

**Alternatives:** Winston — más pesado, menos performante para high-throughput ERP.
