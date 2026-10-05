import type { Model } from 'mongoose';
import { identityModels } from '../modules/identity/infrastructure/models';
import { tenantModels } from '../modules/tenant/infrastructure/models';
import { inventoryModels } from '../modules/inventory/infrastructure/models';
import { maintenanceModels } from '../modules/maintenance/infrastructure/models';
import { productionModels } from '../modules/production/infrastructure/models';
import { purchasingModels } from '../modules/purchasing/infrastructure/models';
import { hrModels } from '../modules/hr/infrastructure/models';
import { financeModels } from '../modules/finance/infrastructure/models';

export const applicationModels: Model<unknown>[] = [
  ...tenantModels,
  ...identityModels,
  ...inventoryModels,
  ...maintenanceModels,
  ...productionModels,
  ...purchasingModels,
  ...hrModels,
  ...financeModels,
];
