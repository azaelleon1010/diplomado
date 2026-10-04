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
    { name: 'auth', description: 'Authentication (Phase 3A)' },
    { name: 'users', description: 'User administration (Phase 3A)' },
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
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Login with email + password (optional tenantId)',
        responses: { '200': { description: 'Token pair + user' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['auth'],
        summary: 'Rotate refresh token',
        responses: { '200': { description: 'New token pair' }, '401': { description: 'Invalid or expired refresh token' } },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['auth'],
        summary: 'Revoke current session',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Logged out' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/me': {
      get: {
        tags: ['auth'],
        summary: 'Current user + memberships + permissions',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Identity context' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/users': {
      get: {
        tags: ['users'],
        summary: 'List users in tenant (paginated)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'User list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing system.users.read' } },
      },
      post: {
        tags: ['users'],
        summary: 'Create user (administrative only)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'User created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing system.users.write' }, '409': { description: 'Duplicate email' } },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['users'],
        summary: 'Get user by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'User' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing system.users.read' }, '404': { description: 'Not found' } },
      },
    },
    '/users/{id}/roles': {
      post: {
        tags: ['users'],
        summary: 'Assign roles to membership',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Membership updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing system.users.write' }, '404': { description: 'Membership not found' } },
      },
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
