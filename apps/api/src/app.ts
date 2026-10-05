import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { getConfig } from '@erp/config';
import { traceMiddleware } from './middleware/trace';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import {
  buildAuthMiddleware,
  buildIdentityDeps,
  createAuthRouter,
  createMeRouter,
  createUsersRouter,
} from './modules/identity/presentation/routes';
import type { RegisterDeps } from './modules/identity/application/usecases';
import { buildInventoryDeps, createInventoryRouter } from './modules/inventory/presentation/routes';
import { buildMaintenanceDeps, createMaintenanceRouter } from './modules/maintenance/presentation/routes';
import { buildProductionDeps, createProductionRouter } from './modules/production/presentation/routes';
import { buildPurchasingDeps, createPurchasingRouter } from './modules/purchasing/presentation/routes';
import { buildHrDeps, createHrRouter } from './modules/hr/presentation/routes';
import { buildFinanceDeps, createFinanceRouter } from './modules/finance/presentation/routes';
import { openApiSpec } from './openapi';

export function createApp(identityDeps?: RegisterDeps) {
  const app = express();
  const config = getConfig();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.CORS_ORIGIN.split(',').map((s) => s.trim()), credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(traceMiddleware);
  app.use(requestLogger);

  // Root
  app.get('/', (req, res) => {
    res.json({ success: true, data: { name: 'ERP Platform API', version: '0.1.0', apiVersion: config.API_VERSION, docs: '/api/v1/openapi.json' }, traceId: req.traceId });
  });

  // OpenAPI
  app.get('/api/v1/openapi.json', (req, res) => {
    res.json({ success: true, data: openApiSpec, traceId: req.traceId });
  });
  app.get('/openapi.json', (req, res) => {
    res.json(openApiSpec);
  });

  // Health
  app.use('/api/v1/health', healthRouter);
  app.use('/health', healthRouter);

  // Identity (Phase 3A): auth + users, tenant-scoped, backend as final authority
  const resolvedIdentityDeps = identityDeps ?? buildIdentityDeps();
  const authMiddleware = buildAuthMiddleware(resolvedIdentityDeps);
  app.use('/api/v1/auth', createAuthRouter(resolvedIdentityDeps, authMiddleware));
  app.use('/api/v1', createMeRouter(resolvedIdentityDeps, authMiddleware));
  app.use('/api/v1/users', createUsersRouter(resolvedIdentityDeps, authMiddleware));

  // Inventory (Phase 1): products, categories, warehouses, stock, movements
  const inventoryDeps = buildInventoryDeps();
  app.use('/api/v1/inventory', createInventoryRouter(inventoryDeps, authMiddleware));

  // Maintenance (Phase 1): assets + maintenance orders
  const maintenanceDeps = buildMaintenanceDeps();
  app.use('/api/v1/maintenance', createMaintenanceRouter(maintenanceDeps, authMiddleware));

  // Production (Phase 2): production orders reusing the inventory catalog
  const productionDeps = buildProductionDeps();
  app.use('/api/v1/production', createProductionRouter(productionDeps, authMiddleware));

  // Purchasing (Phase 3): suppliers + purchase orders reusing the inventory catalog
  const purchasingDeps = buildPurchasingDeps();
  app.use('/api/v1/purchasing', createPurchasingRouter(purchasingDeps, authMiddleware));

  // HR (Phase 4): departments, employees, time off
  const hrDeps = buildHrDeps();
  app.use('/api/v1/hr', createHrRouter(hrDeps, authMiddleware));

  // Finance (Phase 5): accounts, categories, movements
  const financeDeps = buildFinanceDeps();
  app.use('/api/v1/finance', createFinanceRouter(financeDeps, authMiddleware));

  // Placeholder for future modules - illustrates versioned, resource-oriented routing
  // Example: app.use('/api/v1/customers', customersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
