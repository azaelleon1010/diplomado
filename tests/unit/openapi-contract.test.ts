import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openApiSpec } from '../../apps/api/src/openapi';

const ROOT = join(__dirname, '..', '..', 'apps', 'api', 'src', 'modules');

/** Router file → mount prefix(es) under /api/v1 (see apps/api/src/app.ts). */
const ROUTERS: Array<{ file: string; mounts: Record<string, string> }> = [
  { file: 'identity/presentation/routes.ts', mounts: { createAuthRouter: '/auth', createMeRouter: '', createUsersRouter: '/users', createRolesRouter: '/roles' } },
  { file: 'inventory/presentation/routes.ts', mounts: { createInventoryRouter: '/inventory' } },
  { file: 'maintenance/presentation/routes.ts', mounts: { createMaintenanceRouter: '/maintenance' } },
  { file: 'production/presentation/routes.ts', mounts: { createProductionRouter: '/production' } },
  { file: 'purchasing/presentation/routes.ts', mounts: { createPurchasingRouter: '/purchasing' } },
  { file: 'hr/presentation/routes.ts', mounts: { createHrRouter: '/hr' } },
  { file: 'finance/presentation/routes.ts', mounts: { createFinanceRouter: '/finance' } },
];

function declaredRoutes(): string[] {
  const routes: string[] = [];
  for (const { file, mounts } of ROUTERS) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    for (const [factory, prefix] of Object.entries(mounts)) {
      const start = source.indexOf(`export function ${factory}(`);
      expect(start, `${factory} not found in ${file}`).toBeGreaterThanOrEqual(0);
      const next = source.indexOf('export function ', start + 1);
      const body = source.slice(start, next === -1 ? undefined : next);
      for (const match of body.matchAll(/router\.(get|post|patch|put|delete)\(\s*'([^']+)'/g)) {
        const path = `${prefix}${match[2] === '/' ? '' : match[2]}`.replace(/:([A-Za-z]+)/g, '{$1}');
        routes.push(`${match[1]?.toUpperCase()} ${path}`);
      }
    }
  }
  return routes;
}

describe('OpenAPI contract', () => {
  it('documents every route declared by the module routers', () => {
    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
    const documented = new Set(
      Object.entries(paths).flatMap(([path, ops]) => Object.keys(ops).map((method) => `${method.toUpperCase()} ${path}`)),
    );
    const declared = declaredRoutes();
    // Guard against a parser that silently finds nothing.
    expect(declared).toEqual(expect.arrayContaining(['GET /auth/tenant/{slug}', 'POST /inventory/transfers', 'GET /me', 'POST /hr/time-off/{id}/decision']));
    expect(declared.length).toBeGreaterThan(80);
    const missing = declared.filter((route) => !documented.has(route));
    expect(missing).toEqual([]);
  });
});
