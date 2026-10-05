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
    { name: 'inventory', description: 'Inventory catalog: products, categories, warehouses (Phase 1)' },
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
    '/auth/register': {
      post: {
        tags: ['auth'],
        summary: 'Register a new company: tenant + owner role + user + session',
        responses: { '201': { description: 'Company registered, token pair + user' }, '400': { description: 'Validation error' }, '409': { description: 'Duplicate email' } },
      },
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
    '/inventory/categories': {
      get: {
        tags: ['inventory'],
        summary: 'List categories in tenant (paginated)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Category list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.read' } },
      },
      post: {
        tags: ['inventory'],
        summary: 'Create category',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Category created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.create' }, '409': { description: 'Duplicate name' } },
      },
    },
    '/inventory/categories/{id}': {
      get: {
        tags: ['inventory'],
        summary: 'Get category by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Category' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['inventory'],
        summary: 'Update category (optimistic concurrency via expectedVersion)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Category updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.update' }, '404': { description: 'Not found' }, '409': { description: 'Duplicate name or version conflict' } },
      },
      delete: {
        tags: ['inventory'],
        summary: 'Deactivate category (blocked when active products exist)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Category deactivated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.delete' }, '404': { description: 'Not found' }, '409': { description: 'Category has active products' } },
      },
    },
    '/inventory/products': {
      get: {
        tags: ['inventory'],
        summary: 'List products in tenant (paginated, searchable, filterable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Product list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.read' } },
      },
      post: {
        tags: ['inventory'],
        summary: 'Create product (SKU unique per tenant)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Product created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.create' }, '409': { description: 'Duplicate SKU' } },
      },
    },
    '/inventory/products/{id}': {
      get: {
        tags: ['inventory'],
        summary: 'Get product by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Product' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['inventory'],
        summary: 'Update product (optimistic concurrency via expectedVersion)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Product updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.update' }, '404': { description: 'Not found' }, '409': { description: 'Duplicate SKU or version conflict' } },
      },
      delete: {
        tags: ['inventory'],
        summary: 'Deactivate product (logical delete)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Product deactivated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.delete' }, '404': { description: 'Not found' } },
      },
    },
    '/inventory/warehouses': {
      get: {
        tags: ['inventory'],
        summary: 'List warehouses in tenant (paginated, searchable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Warehouse list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.read' } },
      },
      post: {
        tags: ['inventory'],
        summary: 'Create warehouse (code unique per tenant)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Warehouse created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.create' }, '409': { description: 'Duplicate code' } },
      },
    },
    '/inventory/warehouses/{id}': {
      get: {
        tags: ['inventory'],
        summary: 'Get warehouse by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Warehouse' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['inventory'],
        summary: 'Update warehouse (optimistic concurrency via expectedVersion)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Warehouse updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.update' }, '404': { description: 'Not found' }, '409': { description: 'Duplicate code or version conflict' } },
      },
      delete: {
        tags: ['inventory'],
        summary: 'Deactivate warehouse (logical delete)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Warehouse deactivated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.delete' }, '404': { description: 'Not found' } },
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
