/**
 * Seed runner: `npm run seed:identity --workspace @erp/api`
 * Reads credentials from SEED_* env vars (see .env.example). Never logs secrets.
 */
import { connectMongo, disconnectMongo, ensureIndexes } from '@erp/database';
import { readSeedInput, seedIdentity } from '../modules/identity/infrastructure/seed';
import { buildIdentityDeps } from '../modules/identity/presentation/routes';
import { MongoTenantStore } from '../modules/tenant/infrastructure/repositories';
import { applicationModels } from '../infrastructure/models';
import { logger } from '../lib/logger';

async function main() {
  const input = readSeedInput();

  await connectMongo();
  await ensureIndexes(applicationModels);

  const tenantStore = new MongoTenantStore();
  const existingTenant = await tenantStore.findById(input.tenantId);

  if (!existingTenant) {
    await tenantStore.create({
      tenantId: input.tenantId,
      name: input.tenantId,
      slug: input.tenantId.toLowerCase(),
      createdBy: 'seed',
    });

    logger.info(
      { tenantId: input.tenantId },
      'tenant seed created',
    );
  } else {
    logger.info(
      { tenantId: input.tenantId },
      'tenant seed already exists',
    );
  }

  const summary = await seedIdentity(
    buildIdentityDeps(),
    { ...input, adminPassword: input.adminPassword },
  );

  logger.info(
    {
      tenantId: summary.tenantId,
      adminEmail: summary.adminEmail,
    },
    'seed finished',
  );

  await disconnectMongo();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.fatal(
      { err: (err as Error).message },
      'seed failed',
    );
    process.exit(1);
  });
