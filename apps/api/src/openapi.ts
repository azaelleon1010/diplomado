export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ERP Platform API',
    version: '0.1.0',
    description: 'ERP Platform - Modular Monolith Foundation. Multi-tenant, versioned, observable.',
  },
  servers: [{ url: '/api/v1', description: 'Version 1' }],
  tags: [
    { name: 'health', description: 'Health and readiness' },
    { name: 'system', description: 'System info' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['health'],
        summary: 'Overall health including dependencies',
        responses: {
          '200': { description: 'Health status' },
          '503': { description: 'Degraded/down' },
        },
      },
    },
    '/health/live': {
      get: { tags: ['health'], summary: 'Liveness probe', responses: { '200': { description: 'Alive' } } },
    },
    '/health/ready': {
      get: { tags: ['health'], summary: 'Readiness probe', responses: { '200': { description: 'Ready' }, '503': { description: 'Not ready' } } },
    },
    '/health/db': {
      get: { tags: ['health'], summary: 'MongoDB Atlas health', responses: { '200': { description: 'MongoDB up' }, '503': { description: 'MongoDB down' } } },
    },
    '/openapi.json': {
      get: { tags: ['system'], summary: 'OpenAPI spec', responses: { '200': { description: 'Spec' } } },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          meta: { type: 'object' },
          traceId: { type: 'string' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              fields: { type: 'object' },
            },
          },
          traceId: { type: 'string' },
        },
      },
    },
  },
} as const;
