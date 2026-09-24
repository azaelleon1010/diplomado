# ADR-003 — Workspaces (npm vs pnpm)

**Status:** Accepted
**Date:** 2026-09-23
**Context:** AGENTS.md menciona `pnpm-workspace.yaml` + `turbo.json`. Host Windows tiene npm 11.13, Node 24, pero pnpm no instalado; Docker no disponible local.

**Decision:** Usar `npm workspaces` (`package.json` workspaces) como primario — funciona sin instalar nada. Mantener `pnpm-workspace.yaml` para compatibilidad cuando pnpm esté disponible. `turbo.json` pipeline simple (build/lint/test). Migrar a pnpm cuando CI/host lo requiera.

**Consequences:** No bloquea Foundation; `npm install --workspaces` funciona. Lockfile será `package-lock.json`.
