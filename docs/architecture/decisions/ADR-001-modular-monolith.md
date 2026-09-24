# ADR-001 — Modular Monolith

**Status:** Accepted (Foundation)
**Date:** 2026-09-23
**Context:** AGENTS.md §5/§6 exige modular monolith, no microservicios prematuros. Repo vacío confirma que no hay deuda previa.

**Decision:** Monorepo con `apps/` (api, worker, web, mobile) + `modules/` (dominios ERP) + `packages/` (compartidos) + boundaries explícitos (`domain/application/infrastructure/presentation` por módulo). Extracción a servicio solo cuando haya necesidad operativa.

**Consequences:** Menor ops que microservicios, deploy único inicial, límites claros permiten split futuro sin reescribir.

**Alternatives:** Microservicios día 0 — rechazado por complejidad ops prematura.
