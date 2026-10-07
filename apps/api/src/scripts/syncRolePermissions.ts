/**
 * Role-permission sync: `npm run roles:sync-permissions --workspace @erp/api`
 *
 * Dry run by default: prints which owner/admin roles lack catalog
 * permissions. Pass `-- --apply` to write. Additive and idempotent.
 * Against production, run only with explicit authorization.
 */
import { connectMongo, disconnectMongo } from '@erp/database';
import { getConfig } from '@erp/config';
import { syncFullAccessRolePermissions } from '../modules/identity/application/roleSync';
import { MongoAuditSink, MongoRoleStore } from '../modules/identity/infrastructure/repositories';
import { logger } from '../lib/logger';

async function main() {
  const apply = process.argv.includes('--apply');
  const config = getConfig();
  await connectMongo();

  const report = await syncFullAccessRolePermissions(
    { roles: new MongoRoleStore(), audit: new MongoAuditSink() },
    { apply },
  );

  logger.info(
    {
      env: config.NODE_ENV,
      apply: report.apply,
      scanned: report.scanned,
      outdated: report.outdated,
      updated: report.updated,
      roles: report.entries.map((e) => ({ tenantId: e.tenantId, role: e.roleName, missing: e.missing.length, applied: e.applied })),
    },
    apply ? 'role permissions synced' : 'role permission sync (dry run, use --apply to write)',
  );

  await disconnectMongo();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.fatal({ err: (err as Error).message }, 'role permission sync failed');
    process.exit(1);
  });
