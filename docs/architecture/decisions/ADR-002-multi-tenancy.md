# ADR-002 — Multi-Tenancy (tenantId)

**Status:** Accepted
**Date:** 2026-09-23

**Decision:** Colecciones compartidas con `tenantId` obligatorio + `organizationId`/`branchId` cuando aplique. Repositorios siempre filtran por `tenantId`. Sin colecciones por tenant (`customers_tenant_001` prohibido). Índice compuesto inicia por `tenantId`.

**Rationale:** SaaS estándar MongoDB, evita explosion de colecciones, permite sharding por tenant.

**Enforcement:** Tests obligatorios Tenant A→B (403/404) en Fase 2. Middleware `tenantId` desde JWT/session, nunca desde query param sin validar.

**Open:** `legalEntityId` se añadirá cuando fiscal lo requiera.
