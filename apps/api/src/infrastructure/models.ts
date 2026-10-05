import type { Model } from 'mongoose';
import { identityModels } from '../modules/identity/infrastructure/models';
import { tenantModels } from '../modules/tenant/infrastructure/models';
import { inventoryModels } from '../modules/inventory/infrastructure/models';

export const applicationModels: Model<unknown>[] = [
  ...tenantModels,
  ...identityModels,
  ...inventoryModels,
];
