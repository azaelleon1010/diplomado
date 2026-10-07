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
    { name: 'maintenance', description: 'Maintenance: assets and maintenance orders (Phase 1)' },
    { name: 'production', description: 'Production orders reusing the inventory catalog (Phase 2)' },
    { name: 'purchasing', description: 'Purchasing: suppliers and purchase orders (Phase 3)' },
    { name: 'hr', description: 'HR: departments, employees and time off (Phase 4)' },
    { name: 'finance', description: 'Finance: accounts, categories and movements (Phase 5)' },
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
    '/auth/tenant/{slug}': {
      get: {
        tags: ['auth'],
        summary: 'Resolve an ACTIVE company by slug (public; returns tenantId, name, slug)',
        responses: { '200': { description: 'Company' }, '404': { description: 'TENANT_NOT_FOUND' }, '429': { description: 'RATE_LIMITED' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Login with email + password (optional tenantId)',
        responses: { '200': { description: 'Token pair + user' }, '401': { description: 'Invalid credentials' }, '429': { description: 'RATE_LIMITED (per account and per client IP)' } },
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
    '/inventory/stock': {
      get: {
        tags: ['inventory'],
        summary: 'Stock balances per product and warehouse (filters: productId, warehouseId, nonZero)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Balances (paginated)' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.read' } },
      },
    },
    '/inventory/movements': {
      get: {
        tags: ['inventory'],
        summary: 'Immutable stock movements (filters: productId, warehouseId, type, sourceType, sourceId, postingId)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Movements (paginated, newest first)' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing inventory.read' } },
      },
      post: {
        tags: ['inventory'],
        summary: 'Post receipt/issue/adjustment lines atomically. Body: { lines[], reference?, notes?, idempotencyKey }. Per type: RECEIPT inventory.stock.in, ISSUE inventory.stock.out, ADJUSTMENT_* inventory.stock.adjust',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Posting created { postingId, movements, replayed:false }' },
          '200': { description: 'Retry with the same idempotencyKey and payload { replayed:true }' },
          '400': { description: 'Validation error, untracked product or inactive warehouse' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Missing the permission for a line type' },
          '404': { description: 'Product or warehouse not found in tenant' },
          '409': { description: 'INSUFFICIENT_STOCK (nothing written) or IDEMPOTENCY_CONFLICT' },
        },
      },
    },
    '/inventory/transfers': {
      post: {
        tags: ['inventory'],
        summary: 'Transfer stock between warehouses in one posting. Body: { productId, fromWarehouseId, toWarehouseId, quantity, reference?, notes?, idempotencyKey }',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Posting created' }, '200': { description: 'Idempotent replay' }, '400': { description: 'Validation error' }, '403': { description: 'Missing inventory.transfer' }, '409': { description: 'INSUFFICIENT_STOCK or IDEMPOTENCY_CONFLICT' } },
      },
    },
    '/maintenance/assets': {
      get: {
        tags: ['maintenance'],
        summary: 'List assets in tenant (paginated, searchable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Asset list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.read' } },
      },
      post: {
        tags: ['maintenance'],
        summary: 'Create asset (code unique per tenant)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Asset created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.create' }, '409': { description: 'Duplicate code' } },
      },
    },
    '/maintenance/assets/{id}': {
      get: {
        tags: ['maintenance'],
        summary: 'Get asset by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Asset' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['maintenance'],
        summary: 'Update asset (optimistic concurrency via expectedVersion)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Asset updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.update' }, '404': { description: 'Not found' }, '409': { description: 'Version conflict' } },
      },
      delete: {
        tags: ['maintenance'],
        summary: 'Retire asset (blocked when open orders exist)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Asset retired' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.delete' }, '404': { description: 'Not found' }, '409': { description: 'Asset has open orders' } },
      },
    },
    '/maintenance/orders': {
      get: {
        tags: ['maintenance'],
        summary: 'List maintenance orders in tenant (filterable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.read' } },
      },
      post: {
        tags: ['maintenance'],
        summary: 'Create maintenance order for an asset',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Order created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.create' }, '404': { description: 'Asset not found' } },
      },
    },
    '/maintenance/orders/{id}': {
      get: {
        tags: ['maintenance'],
        summary: 'Get maintenance order by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Maintenance order' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['maintenance'],
        summary: 'Update order (only while open, in progress or on hold)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.update' }, '404': { description: 'Not found' }, '409': { description: 'Version conflict or invalid state' } },
      },
      delete: {
        tags: ['maintenance'],
        summary: 'Cancel order (logical cancel)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order cancelled' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.delete' }, '404': { description: 'Not found' }, '409': { description: 'Order cannot be cancelled' } },
      },
    },
    '/maintenance/orders/{id}/transition': {
      post: {
        tags: ['maintenance'],
        summary: 'Transition order state (start, hold, complete, cancel)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order transitioned' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing maintenance.update' }, '404': { description: 'Not found' }, '409': { description: 'Invalid transition or version conflict' } },
      },
    },
    '/production/orders': {
      get: {
        tags: ['production'],
        summary: 'List production orders in tenant (filterable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing production.read' } },
      },
      post: {
        tags: ['production'],
        summary: 'Create production order from the inventory catalog',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Order created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing production.create' }, '404': { description: 'Product not found' }, '409': { description: 'Duplicate code' } },
      },
    },
    '/production/orders/{id}': {
      get: {
        tags: ['production'],
        summary: 'Get production order by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Production order' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing production.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['production'],
        summary: 'Update order (only while draft, released or paused)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing production.update' }, '404': { description: 'Not found' }, '409': { description: 'Version conflict or invalid state' } },
      },
      delete: {
        tags: ['production'],
        summary: 'Cancel order (logical cancel)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order cancelled' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing production.delete' }, '404': { description: 'Not found' }, '409': { description: 'Order cannot be cancelled' } },
      },
    },
    '/production/orders/{id}/transition': {
      post: {
        tags: ['production'],
        summary: 'Transition order state (release, start, pause, complete, cancel)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order transitioned' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing production.update' }, '404': { description: 'Not found' }, '409': { description: 'Invalid transition or version conflict' } },
      },
    },
    '/purchasing/suppliers': {
      get: {
        tags: ['purchasing'],
        summary: 'List suppliers in tenant (paginated, searchable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Supplier list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.read' } },
      },
      post: {
        tags: ['purchasing'],
        summary: 'Create supplier (code unique per tenant)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Supplier created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.create' }, '409': { description: 'Duplicate code' } },
      },
    },
    '/purchasing/suppliers/{id}': {
      get: {
        tags: ['purchasing'],
        summary: 'Get supplier by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Supplier' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['purchasing'],
        summary: 'Update supplier (optimistic concurrency via expectedVersion)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Supplier updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.update' }, '404': { description: 'Not found' }, '409': { description: 'Version conflict' } },
      },
      delete: {
        tags: ['purchasing'],
        summary: 'Deactivate supplier (blocked with purchase orders)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Supplier deactivated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.delete' }, '404': { description: 'Not found' }, '409': { description: 'Supplier has purchase orders' } },
      },
    },
    '/purchasing/orders': {
      get: {
        tags: ['purchasing'],
        summary: 'List purchase orders in tenant (filterable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.read' } },
      },
      post: {
        tags: ['purchasing'],
        summary: 'Create purchase order from the inventory catalog',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Order created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.create' }, '404': { description: 'Supplier or product not found' }, '409': { description: 'Duplicate folio' } },
      },
    },
    '/purchasing/orders/{id}': {
      get: {
        tags: ['purchasing'],
        summary: 'Get purchase order by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Purchase order' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['purchasing'],
        summary: 'Update draft order (lines, dates, notes)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.update' }, '404': { description: 'Not found' }, '409': { description: 'Version conflict or invalid state' } },
      },
      delete: {
        tags: ['purchasing'],
        summary: 'Cancel order (logical cancel)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order cancelled' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.delete' }, '404': { description: 'Not found' }, '409': { description: 'Order cannot be cancelled' } },
      },
    },
    '/purchasing/orders/{id}/transition': {
      post: {
        tags: ['purchasing'],
        summary: 'Transition order state (send, approve, receive, cancel)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Order transitioned' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing purchasing.update' }, '404': { description: 'Not found' }, '409': { description: 'Invalid transition or version conflict' } },
      },
    },
    '/hr/departments': {
      get: {
        tags: ['hr'],
        summary: 'List departments in tenant',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Department list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.read.team' } },
      },
      post: {
        tags: ['hr'],
        summary: 'Create department (name unique per tenant)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Department created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.write' }, '409': { description: 'Duplicate name' } },
      },
    },
    '/hr/departments/{id}': {
      get: {
        tags: ['hr'],
        summary: 'Get department by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Department' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.read.team' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['hr'],
        summary: 'Update department (optimistic concurrency via expectedVersion)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Department updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.write' }, '404': { description: 'Not found' }, '409': { description: 'Duplicate name or version conflict' } },
      },
      delete: {
        tags: ['hr'],
        summary: 'Deactivate department (blocked with active employees)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Department deactivated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.write' }, '404': { description: 'Not found' }, '409': { description: 'Department has active employees' } },
      },
    },
    '/hr/employees': {
      get: {
        tags: ['hr'],
        summary: 'List employees in tenant (searchable, filterable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Employee list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.read.team' } },
      },
      post: {
        tags: ['hr'],
        summary: 'Create employee (code unique per tenant)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Employee created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.write' }, '409': { description: 'Duplicate code' } },
      },
    },
    '/hr/employees/{id}': {
      get: {
        tags: ['hr'],
        summary: 'Get employee by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Employee' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.read.team' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['hr'],
        summary: 'Update employee (optimistic concurrency via expectedVersion)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Employee updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.write' }, '404': { description: 'Not found' }, '409': { description: 'Duplicate code or version conflict' } },
      },
      delete: {
        tags: ['hr'],
        summary: 'Deactivate employee (logical delete)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Employee deactivated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.write' }, '404': { description: 'Not found' } },
      },
    },
    '/hr/time-off': {
      get: {
        tags: ['hr'],
        summary: 'List time-off requests in tenant (filterable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Time-off list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.read.self' } },
      },
      post: {
        tags: ['hr'],
        summary: 'Create time-off request for an employee',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Request created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.read.self' }, '404': { description: 'Employee not found' } },
      },
    },
    '/hr/time-off/{id}': {
      get: {
        tags: ['hr'],
        summary: 'Get time-off request by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Time-off request' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.read.self' }, '404': { description: 'Not found' } },
      },
    },
    '/hr/time-off/{id}/decision': {
      post: {
        tags: ['hr'],
        summary: 'Approve or reject a pending request',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Request decided' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.write' }, '404': { description: 'Not found' }, '409': { description: 'Request is not pending' } },
      },
    },
    '/hr/time-off/{id}/cancel': {
      post: {
        tags: ['hr'],
        summary: 'Cancel a pending request',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Request cancelled' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing hr.read.self' }, '404': { description: 'Not found' }, '409': { description: 'Request is not pending' } },
      },
    },
    '/finance/accounts': {
      get: {
        tags: ['finance'],
        summary: 'List accounts in tenant (chart of accounts)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Account list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.read' } },
      },
      post: {
        tags: ['finance'],
        summary: 'Create account (code unique per tenant)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Account created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.create' }, '409': { description: 'Duplicate code' } },
      },
    },
    '/finance/accounts/{id}': {
      get: {
        tags: ['finance'],
        summary: 'Get account by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Account' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['finance'],
        summary: 'Update account (optimistic concurrency via expectedVersion)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Account updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.update' }, '404': { description: 'Not found' }, '409': { description: 'Version conflict' } },
      },
      delete: {
        tags: ['finance'],
        summary: 'Deactivate account (blocked with movements)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Account deactivated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.delete' }, '404': { description: 'Not found' }, '409': { description: 'Account has movements' } },
      },
    },
    '/finance/categories': {
      get: {
        tags: ['finance'],
        summary: 'List income/expense categories in tenant',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Category list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.read' } },
      },
      post: {
        tags: ['finance'],
        summary: 'Create category (name unique per tenant)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Category created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.create' }, '409': { description: 'Duplicate name' } },
      },
    },
    '/finance/categories/{id}': {
      get: {
        tags: ['finance'],
        summary: 'Get category by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Category' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.read' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['finance'],
        summary: 'Update category (optimistic concurrency via expectedVersion)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Category updated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.update' }, '404': { description: 'Not found' }, '409': { description: 'Duplicate name or version conflict' } },
      },
      delete: {
        tags: ['finance'],
        summary: 'Deactivate category (blocked with movements)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Category deactivated' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.delete' }, '404': { description: 'Not found' }, '409': { description: 'Category has movements' } },
      },
    },
    '/finance/movements/totals': {
      get: {
        tags: ['finance'],
        summary: 'Income, expenses and balance from posted movements',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Totals' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.read' } },
      },
    },
    '/finance/movements': {
      get: {
        tags: ['finance'],
        summary: 'List movements in tenant (filterable)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Movement list' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.read' } },
      },
      post: {
        tags: ['finance'],
        summary: 'Create income or expense movement',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Movement created' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.create' }, '404': { description: 'Account not found' } },
      },
    },
    '/finance/movements/{id}': {
      get: {
        tags: ['finance'],
        summary: 'Get movement by id (tenant-scoped)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Movement' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.read' }, '404': { description: 'Not found' } },
      },
    },
    '/finance/movements/{id}/void': {
      post: {
        tags: ['finance'],
        summary: 'Void a posted movement (no destructive deletes)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Movement voided' }, '401': { description: 'Unauthorized' }, '403': { description: 'Missing finance.update' }, '404': { description: 'Not found' }, '409': { description: 'Only posted movements can be voided' } },
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
