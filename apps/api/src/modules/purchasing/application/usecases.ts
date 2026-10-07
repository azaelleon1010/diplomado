/**
 * Purchasing use cases — orchestrate ports, enforce business rules.
 * No Express, no Mongoose here.
 *
 * Products always come from the inventory catalog (never duplicated).
 * Receptions are goods receipts that post to the inventory ledger
 * (application/receipts.ts).
 */
import { AppError } from '@erp/errors';
import { sanitizeForAudit } from '../../identity/domain/entities';
import type { IAuditSink } from '../../identity/domain/ports';
import type { AuditResult } from '../../identity/domain/entities';
import { PURCHASING_ACTIONS, type PurchaseOrderStatus, type SupplierStatus } from '../domain/entities';
import type {
  CreatePurchaseOrderData,
  IPurchaseOrderStore,
  ISupplierStore,
  OrderFilters,
  SupplierFilters,
  SupplierTermsData,
  UpdatePurchaseOrderData,
} from '../domain/ports';
import type { IProductStore } from '../../inventory/domain/ports';

export interface PurchasingDeps {
  suppliers: ISupplierStore;
  orders: IPurchaseOrderStore;
  products: IProductStore;
  audit: IAuditSink;
}

export interface PurchasingActor {
  userId: string;
  tenantId: string;
  correlationId?: string;
}

async function audit(deps: PurchasingDeps, event: { tenantId: string; userId?: string; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; result: AuditResult; correlationId?: string }) {
  await deps.audit.record({
    tenantId: event.tenantId,
    userId: event.userId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    before: sanitizeForAudit(event.before),
    after: sanitizeForAudit(event.after),
    result: event.result,
    correlationId: event.correlationId,
  });
}

function notFound(entity: string): AppError {
  return new AppError({ code: 'NOT_FOUND', message: `${entity} not found`, statusCode: 404 });
}

function duplicate(field: string): AppError {
  return new AppError({ code: 'CONFLICT', message: `Duplicate value for ${field}`, statusCode: 409, fields: { duplicateFields: { [field]: true } } });
}

function invalid(message: string, fields?: Record<string, unknown>): AppError {
  return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}

async function assertSupplierUsable(deps: PurchasingDeps, tenantId: string, supplierId: string) {
  const supplier = await deps.suppliers.findById(tenantId, supplierId);
  if (!supplier) throw notFound('Supplier');
  if (supplier.status !== 'ACTIVE') {
    throw invalid('Supplier is not active');
  }
  return supplier;
}

async function assertCatalogProduct(deps: PurchasingDeps, tenantId: string, productId: string) {
  const product = await deps.products.findById(tenantId, productId);
  if (!product) throw notFound('Product');
  if (product.status !== 'ACTIVE') {
    throw invalid(`Product ${product.sku} is not active`);
  }
  return product;
}

function assertLines(lines: Array<{ productId: string; quantity: number; unitCost: number }>): void {
  if (lines.length === 0) {
    throw invalid('Order must contain at least one line');
  }
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.productId)) {
      throw invalid('Duplicate product in order lines', { productId: line.productId });
    }
    seen.add(line.productId);
    if (!(line.quantity > 0)) throw invalid('Line quantity must be greater than 0', { productId: line.productId });
    if (line.unitCost < 0) throw invalid('Line unitCost cannot be negative', { productId: line.productId });
  }
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

type SupplierTermsInput = SupplierTermsData;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalizes and validates commercial terms and contacts. */
function normalizeTerms(input: SupplierTermsInput): SupplierTermsData {
  const out: SupplierTermsData = {};
  if (input.paymentTermsDays !== undefined) out.paymentTermsDays = input.paymentTermsDays;
  if (input.currency !== undefined) out.currency = input.currency.trim().toUpperCase();
  if (input.leadTimeDays !== undefined) out.leadTimeDays = input.leadTimeDays;
  if (input.contacts !== undefined) {
    const contacts = input.contacts.map((c) => ({
      name: c.name.trim(),
      ...(c.email?.trim() ? { email: c.email.trim().toLowerCase() } : {}),
      ...(c.phone?.trim() ? { phone: c.phone.trim() } : {}),
      ...(c.role?.trim() ? { role: c.role.trim() } : {}),
      ...(c.isPrimary ? { isPrimary: true } : {}),
    }));
    for (const contact of contacts) {
      if (contact.email && !EMAIL_RE.test(contact.email)) throw invalid('Invalid contact email', { contact: contact.name });
    }
    if (contacts.filter((c) => c.isPrimary).length > 1) throw invalid('Only one primary contact is allowed');
    out.contacts = contacts;
  }
  return out;
}

export interface CreateSupplierInput extends SupplierTermsInput {
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

export async function createSupplier(ctx: PurchasingActor, input: CreateSupplierInput, deps: PurchasingDeps) {
  const code = input.code.trim().toUpperCase();
  const existing = await deps.suppliers.findByCode(ctx.tenantId, code);
  if (existing) throw duplicate('code');
  if (input.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    throw invalid('Invalid supplier email');
  }
  const created = await deps.suppliers.create({
    tenantId: ctx.tenantId,
    code,
    name: input.name.trim(),
    contactName: input.contactName?.trim() || undefined,
    email: input.email?.trim().toLowerCase() || undefined,
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    taxId: input.taxId?.trim() || undefined,
    ...normalizeTerms(input),
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: PURCHASING_ACTIONS.SUPPLIER_CREATED,
    entityType: 'supplier',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { code: created.code, name: created.name },
  });
  return created;
}

export async function getSupplier(ctx: PurchasingActor, id: string, deps: PurchasingDeps) {
  const supplier = await deps.suppliers.findById(ctx.tenantId, id);
  if (!supplier) throw notFound('Supplier');
  return supplier;
}

export async function listSuppliers(ctx: PurchasingActor, filters: SupplierFilters, page: number, limit: number, sortBy: string, sortOrder: 'asc' | 'desc', deps: PurchasingDeps) {
  return deps.suppliers.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
}

export interface UpdateSupplierInput extends SupplierTermsInput {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  status?: SupplierStatus;
  expectedVersion: number;
}

export async function updateSupplier(ctx: PurchasingActor, id: string, input: UpdateSupplierInput, deps: PurchasingDeps) {
  const before = await deps.suppliers.findById(ctx.tenantId, id);
  if (!before) throw notFound('Supplier');
  const { expectedVersion, ...fields } = input;
  if (fields.email !== undefined && fields.email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    throw invalid('Invalid supplier email');
  }
  const updated = await deps.suppliers.update(ctx.tenantId, id, { ...fields, ...normalizeTerms(fields) }, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Supplier');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: PURCHASING_ACTIONS.SUPPLIER_UPDATED,
    entityType: 'supplier',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { name: before.name, status: before.status },
    after: { name: updated.name, status: updated.status },
  });
  return updated;
}

export async function deactivateSupplier(ctx: PurchasingActor, id: string, deps: PurchasingDeps) {
  const supplier = await deps.suppliers.findById(ctx.tenantId, id);
  if (!supplier) throw notFound('Supplier');
  const linked = await deps.orders.countBySupplier(ctx.tenantId, id);
  if (linked > 0) {
    throw new AppError({
      code: 'CONFLICT',
      message: `Supplier has ${linked} purchase order(s) and cannot be deactivated`,
      statusCode: 409,
      fields: { purchaseOrders: linked },
    });
  }
  const updated = await deps.suppliers.update(ctx.tenantId, id, { status: 'INACTIVE' }, supplier.version, ctx.userId);
  if (!updated) throw notFound('Supplier');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: PURCHASING_ACTIONS.SUPPLIER_DEACTIVATED,
    entityType: 'supplier',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: supplier.status },
    after: { status: updated.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

export interface CreatePurchaseOrderInput {
  folio: string;
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number }>;
}

export async function createPurchaseOrder(ctx: PurchasingActor, input: CreatePurchaseOrderInput, deps: PurchasingDeps) {
  const folio = input.folio.trim().toUpperCase();
  const existing = await deps.orders.findByFolio(ctx.tenantId, folio);
  if (existing) throw duplicate('folio');
  await assertSupplierUsable(deps, ctx.tenantId, input.supplierId);
  assertLines(input.lines);
  for (const line of input.lines) {
    await assertCatalogProduct(deps, ctx.tenantId, line.productId);
  }
  const created = await deps.orders.create({
    tenantId: ctx.tenantId,
    folio,
    supplierId: input.supplierId,
    expectedDate: input.expectedDate?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    lines: input.lines,
    createdBy: ctx.userId,
  } satisfies CreatePurchaseOrderData);
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: PURCHASING_ACTIONS.ORDER_CREATED,
    entityType: 'purchaseOrder',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { folio: created.folio, supplierId: created.supplierId, subtotal: created.subtotal, lines: created.lines.length },
  });
  return created;
}

export async function getPurchaseOrder(ctx: PurchasingActor, id: string, deps: PurchasingDeps) {
  const order = await deps.orders.findById(ctx.tenantId, id);
  if (!order) throw notFound('Purchase order');
  return order;
}

export async function listPurchaseOrders(ctx: PurchasingActor, filters: OrderFilters, page: number, limit: number, sortBy: string, sortOrder: 'asc' | 'desc', deps: PurchasingDeps) {
  return deps.orders.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
}

export interface UpdatePurchaseOrderInput extends UpdatePurchaseOrderData {
  expectedVersion: number;
}

const EDITABLE_STATUSES: PurchaseOrderStatus[] = ['DRAFT'];

export async function updatePurchaseOrder(ctx: PurchasingActor, id: string, input: UpdatePurchaseOrderInput, deps: PurchasingDeps) {
  const before = await deps.orders.findById(ctx.tenantId, id);
  if (!before) throw notFound('Purchase order');
  if (!EDITABLE_STATUSES.includes(before.status)) {
    throw invalid(`Order in status ${before.status} cannot be edited`);
  }
  const { expectedVersion, ...fields } = input;
  if (fields.lines !== undefined) {
    assertLines(fields.lines);
    for (const line of fields.lines) {
      await assertCatalogProduct(deps, ctx.tenantId, line.productId);
    }
  }
  const updated = await deps.orders.update(ctx.tenantId, id, fields, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Purchase order');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: PURCHASING_ACTIONS.ORDER_UPDATED,
    entityType: 'purchaseOrder',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { subtotal: before.subtotal, status: before.status },
    after: { subtotal: updated.subtotal, status: updated.status },
  });
  return updated;
}

const TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

const TRANSITION_ACTIONS = {
  SENT: PURCHASING_ACTIONS.ORDER_SENT,
  APPROVED: PURCHASING_ACTIONS.ORDER_APPROVED,
  PARTIALLY_RECEIVED: PURCHASING_ACTIONS.ORDER_RECEIVED,
  RECEIVED: PURCHASING_ACTIONS.ORDER_RECEIVED,
  CANCELLED: PURCHASING_ACTIONS.ORDER_CANCELLED,
} as const;

/**
 * Manual status changes. Receptions are NOT transitions: they are goods
 * receipts (application/receipts.ts) that also move inventory.
 */
export async function transitionPurchaseOrder(
  ctx: PurchasingActor,
  id: string,
  to: PurchaseOrderStatus,
  expectedVersion: number,
  deps: PurchasingDeps,
) {
  if (to === 'RECEIVED' || to === 'PARTIALLY_RECEIVED') {
    throw invalid('Receptions are registered as goods receipts: POST /api/v1/purchasing/orders/:id/receipts', { use: 'receipts' });
  }
  const before = await deps.orders.findById(ctx.tenantId, id);
  if (!before) throw notFound('Purchase order');
  if (!TRANSITIONS[before.status].includes(to)) {
    throw invalid(`Cannot transition order from ${before.status} to ${to}`, { from: before.status, to });
  }
  const updated = await deps.orders.transition(ctx.tenantId, id, to, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Purchase order');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: TRANSITION_ACTIONS[to as keyof typeof TRANSITION_ACTIONS] ?? PURCHASING_ACTIONS.ORDER_UPDATED,
    entityType: 'purchaseOrder',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: before.status },
    after: { status: updated.status, subtotal: updated.subtotal },
  });
  return updated;
}

export async function cancelPurchaseOrder(ctx: PurchasingActor, id: string, deps: PurchasingDeps) {
  const order = await deps.orders.findById(ctx.tenantId, id);
  if (!order) throw notFound('Purchase order');
  return transitionPurchaseOrder(ctx, id, 'CANCELLED', order.version, deps);
}
