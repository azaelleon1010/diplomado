/**
 * Production use cases — orchestrate ports, enforce business rules.
 * No Express, no Mongoose here.
 *
 * Finished-good and material products always come from the inventory
 * catalog (never a duplicated catalog).
 */
import { AppError } from '@erp/errors';
import { sanitizeForAudit } from '../../identity/domain/entities';
import type { IAuditSink } from '../../identity/domain/ports';
import type { AuditResult } from '../../identity/domain/entities';
import { PRODUCTION_ACTIONS, type ProductionOrderStatus } from '../domain/entities';
import type {
  CreateProductionOrderData,
  IProductionOrderStore,
  ProductionOrderFilters,
  UpdateProductionOrderData,
} from '../domain/ports';
import type { IProductStore } from '../../inventory/domain/ports';

export interface ProductionDeps {
  orders: IProductionOrderStore;
  products: IProductStore;
  audit: IAuditSink;
}

export interface ProductionActor {
  userId: string;
  tenantId: string;
  correlationId?: string;
}

async function audit(deps: ProductionDeps, event: { tenantId: string; userId?: string; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; result: AuditResult; correlationId?: string }) {
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

async function assertProductUsable(deps: ProductionDeps, tenantId: string, productId: string, label: string): Promise<void> {
  const product = await deps.products.findById(tenantId, productId);
  if (!product) throw notFound(`Product (${label})`);
  if (product.status !== 'ACTIVE') {
    throw invalid(`Product ${product.sku} is not active`);
  }
}

export interface CreateProductionOrderInput {
  code: string;
  productId: string;
  quantity: number;
  machine?: string;
  responsible?: string;
  dueDate?: string;
  notes?: string;
  materials: Array<{ productId: string; quantityRequired: number }>;
}

export async function createProductionOrder(ctx: ProductionActor, input: CreateProductionOrderInput, deps: ProductionDeps) {
  const code = input.code.trim().toUpperCase();
  const existing = await deps.orders.findByCode(ctx.tenantId, code);
  if (existing) throw duplicate('code');
  if (input.quantity <= 0) throw invalid('quantity must be greater than 0');
  await assertProductUsable(deps, ctx.tenantId, input.productId, 'finished good');
  const seen = new Set<string>();
  for (const material of input.materials) {
    if (seen.has(material.productId)) {
      throw invalid('Duplicate material product', { productId: material.productId });
    }
    seen.add(material.productId);
    if (material.quantityRequired <= 0) {
      throw invalid('Material quantityRequired must be greater than 0', { productId: material.productId });
    }
    await assertProductUsable(deps, ctx.tenantId, material.productId, 'material');
  }
  const created = await deps.orders.create({
    tenantId: ctx.tenantId,
    code,
    productId: input.productId,
    quantity: input.quantity,
    machine: input.machine?.trim() || undefined,
    responsible: input.responsible?.trim() || undefined,
    dueDate: input.dueDate?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    materials: input.materials.map((m) => ({ productId: m.productId, quantityRequired: m.quantityRequired })),
    createdBy: ctx.userId,
  } satisfies CreateProductionOrderData);
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: PRODUCTION_ACTIONS.ORDER_CREATED,
    entityType: 'productionOrder',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { code: created.code, productId: created.productId, quantity: created.quantity },
  });
  return created;
}

export async function getProductionOrder(ctx: ProductionActor, id: string, deps: ProductionDeps) {
  const order = await deps.orders.findById(ctx.tenantId, id);
  if (!order) throw notFound('Production order');
  return order;
}

export async function listProductionOrders(ctx: ProductionActor, filters: ProductionOrderFilters, page: number, limit: number, sortBy: string, sortOrder: 'asc' | 'desc', deps: ProductionDeps) {
  return deps.orders.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
}

export interface UpdateProductionOrderInput extends UpdateProductionOrderData {
  expectedVersion: number;
}

const EDITABLE_STATUSES: ProductionOrderStatus[] = ['DRAFT', 'RELEASED', 'PAUSED'];

export async function updateProductionOrder(ctx: ProductionActor, id: string, input: UpdateProductionOrderInput, deps: ProductionDeps) {
  const before = await deps.orders.findById(ctx.tenantId, id);
  if (!before) throw notFound('Production order');
  if (!EDITABLE_STATUSES.includes(before.status)) {
    throw invalid(`Order in status ${before.status} cannot be edited`);
  }
  const { expectedVersion, ...fields } = input;
  if (fields.quantity !== undefined && fields.quantity <= 0) {
    throw invalid('quantity must be greater than 0');
  }
  if (fields.materials !== undefined) {
    const seen = new Set<string>();
    for (const material of fields.materials) {
      if (seen.has(material.productId)) {
        throw invalid('Duplicate material product', { productId: material.productId });
      }
      seen.add(material.productId);
      if (material.quantityRequired <= 0) {
        throw invalid('Material quantityRequired must be greater than 0', { productId: material.productId });
      }
      await assertProductUsable(deps, ctx.tenantId, material.productId, 'material');
    }
  }
  const updated = await deps.orders.update(ctx.tenantId, id, fields, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Production order');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: PRODUCTION_ACTIONS.ORDER_UPDATED,
    entityType: 'productionOrder',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { quantity: before.quantity, status: before.status },
    after: { quantity: updated.quantity, status: updated.status },
  });
  return updated;
}

const TRANSITIONS: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
  DRAFT: ['RELEASED', 'CANCELLED'],
  RELEASED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const TRANSITION_ACTIONS = {
  RELEASED: PRODUCTION_ACTIONS.ORDER_RELEASED,
  IN_PROGRESS: PRODUCTION_ACTIONS.ORDER_STARTED,
  PAUSED: PRODUCTION_ACTIONS.ORDER_PAUSED,
  COMPLETED: PRODUCTION_ACTIONS.ORDER_COMPLETED,
  CANCELLED: PRODUCTION_ACTIONS.ORDER_CANCELLED,
} as const;

export interface CompleteProductionInput {
  producedQuantity?: number;
  materials?: Array<{ productId: string; quantityRequired: number; quantityConsumed?: number }>;
}

export async function transitionProductionOrder(
  ctx: ProductionActor,
  id: string,
  to: ProductionOrderStatus,
  expectedVersion: number,
  complete: CompleteProductionInput | undefined,
  deps: ProductionDeps,
) {
  const before = await deps.orders.findById(ctx.tenantId, id);
  if (!before) throw notFound('Production order');
  if (!TRANSITIONS[before.status].includes(to)) {
    throw invalid(`Cannot transition order from ${before.status} to ${to}`, { from: before.status, to });
  }
  let producedQuantity: number | undefined;
  let materials: Array<{ productId: string; quantityRequired: number; quantityConsumed?: number }> | undefined;
  if (to === 'COMPLETED') {
    producedQuantity = complete?.producedQuantity ?? before.quantity;
    if (producedQuantity < 0) throw invalid('producedQuantity cannot be negative');
    // Consumption snapshot: when the caller does not send explicit materials,
    // each material defaults to its required quantity.
    const explicit = complete?.materials;
    const source = explicit ?? before.materials;
    const seen = new Set<string>();
    materials = [];
    for (const material of source) {
      if (seen.has(material.productId)) {
        throw invalid('Duplicate material product', { productId: material.productId });
      }
      seen.add(material.productId);
      if (material.quantityRequired <= 0) {
        throw invalid('Material quantityRequired must be greater than 0', { productId: material.productId });
      }
      const consumed = explicit ? (material.quantityConsumed ?? material.quantityRequired) : material.quantityRequired;
      if (consumed < 0) throw invalid('Material quantityConsumed cannot be negative', { productId: material.productId });
      materials.push({ productId: material.productId, quantityRequired: material.quantityRequired, quantityConsumed: consumed });
    }
  }
  const updated = await deps.orders.transition(ctx.tenantId, id, to, expectedVersion, ctx.userId, { producedQuantity, materials });
  if (!updated) throw notFound('Production order');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: TRANSITION_ACTIONS[to as keyof typeof TRANSITION_ACTIONS] ?? PRODUCTION_ACTIONS.ORDER_UPDATED,
    entityType: 'productionOrder',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: before.status, producedQuantity: before.producedQuantity },
    after: { status: updated.status, producedQuantity: updated.producedQuantity, materials: updated.materials },
  });
  return updated;
}

export async function cancelProductionOrder(ctx: ProductionActor, id: string, deps: ProductionDeps) {
  const order = await deps.orders.findById(ctx.tenantId, id);
  if (!order) throw notFound('Production order');
  return transitionProductionOrder(ctx, id, 'CANCELLED', order.version, undefined, deps);
}
