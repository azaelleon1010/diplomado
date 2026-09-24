import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { getConfig } from '@erp/config';
import { traceMiddleware } from './middleware/trace';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { openApiSpec } from './openapi';

export function createApp() {
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

  // Placeholder for future modules - illustrates versioned, resource-oriented routing
  // Example: app.use('/api/v1/auth', authRouter);
  // Example: app.use('/api/v1/customers', customersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
