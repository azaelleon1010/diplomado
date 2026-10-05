/**
 * Maintenance use cases — orchestrate ports, enforce business rules.
 * No Express, no Mongoose here.
 */
import { AppError } from '@erp/errors';
import { sanitizeForAudit } from '../../identity/domain/entities';
import type { IAuditSink } from '../../identity/domain/ports';
import type { AuditResult } from '../../identity/domain/entities';
import {
  MAINTENANCE_ACTIONS,
  type AssetStatus,
  type MaintenanceOrderStatus,
} from '../domain/entities';
import type {
  CreateAssetData,
  CreateOrderData,
  IAssetStore,
  IMaintenanceOrderStore,
  OrderFilters,
  AssetFilters,
  UpdateAssetData,
  UpdateOrderData,
} from '../domain/ports';

export interface MaintenanceDeps {
  assets: IAssetStore;
  orders: IMaintenanceOrderStore;
  audit: IAuditSink;
}

export interface MaintenanceActor {
  userId: string;
  tenantId: string;
  correlationId?: string;
}

async function audit(deps: MaintenanceDeps, event: { tenantId: string; userId?: string; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; result: AuditResult; correlationId?: string }) {
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

async function assertAssetUsable(deps: MaintenanceDeps, tenantId: string, assetId: string) {
  const asset = await deps.assets.findById(tenantId, assetId);
  if (!asset) throw notFound('Asset');
  if (asset.status === 'RETIRED') {
    throw invalid('Asset is retired');
  }
  return asset;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface CreateAssetInput {
  code: string;
  name: string;
  type: string;
  location?: string;
  responsible?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
}

export async function createAsset(ctx: MaintenanceActor, input: CreateAssetInput, deps: MaintenanceDeps) {
  const code = input.code.trim().toUpperCase();
  const existing = await deps.assets.findByCode(ctx.tenantId, code);
  if (existing) throw duplicate('code');
  const created = await deps.assets.create({
    tenantId: ctx.tenantId,
    code,
    name: input.name.trim(),
    type: input.type.trim(),
    location: input.location?.trim() || undefined,
    responsible: input.responsible?.trim() || undefined,
    purchaseDate: input.purchaseDate?.trim() || undefined,
    warrantyUntil: input.warrantyUntil?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdBy: ctx.userId,
  } satisfies CreateAssetData);
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: MAINTENANCE_ACTIONS.ASSET_CREATED,
    entityType: 'asset',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { code: created.code, name: created.name },
  });
  return created;
}

export async function getAsset(ctx: MaintenanceActor, id: string, deps: MaintenanceDeps) {
  const asset = await deps.assets.findById(ctx.tenantId, id);
  if (!asset) throw notFound('Asset');
  return asset;
}

export async function listAssets(ctx: MaintenanceActor, filters: AssetFilters, page: number, limit: number, sortBy: string, sortOrder: 'asc' | 'desc', deps: MaintenanceDeps) {
  return deps.assets.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
}

export interface UpdateAssetInput extends UpdateAssetData {
  expectedVersion: number;
}

export async function updateAsset(ctx: MaintenanceActor, id: string, input: UpdateAssetInput, deps: MaintenanceDeps) {
  const before = await deps.assets.findById(ctx.tenantId, id);
  if (!before) throw notFound('Asset');
  const { expectedVersion, ...fields } = input;
  const updated = await deps.assets.update(ctx.tenantId, id, fields, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Asset');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: MAINTENANCE_ACTIONS.ASSET_UPDATED,
    entityType: 'asset',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { name: before.name, status: before.status },
    after: { name: updated.name, status: updated.status },
  });
  return updated;
}

export async function retireAsset(ctx: MaintenanceActor, id: string, deps: MaintenanceDeps) {
  const asset = await deps.assets.findById(ctx.tenantId, id);
  if (!asset) throw notFound('Asset');
  const open = await deps.orders.countOpenByAsset(ctx.tenantId, id);
  if (open > 0) {
    throw new AppError({
      code: 'CONFLICT',
      message: `Asset has ${open} open maintenance order(s) and cannot be retired`,
      statusCode: 409,
      fields: { openOrders: open },
    });
  }
  const updated = await deps.assets.setStatus(ctx.tenantId, id, 'RETIRED', asset.version, ctx.userId);
  if (!updated) throw notFound('Asset');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: MAINTENANCE_ACTIONS.ASSET_RETIRED,
    entityType: 'asset',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: asset.status },
    after: { status: updated.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Maintenance orders
// ---------------------------------------------------------------------------

export interface CreateOrderInput {
  assetId: string;
  type: 'PREVENTIVE' | 'CORRECTIVE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description?: string;
  scheduledFor?: string;
  cost?: number;
  assignedTo?: string;
  notes?: string;
}

export async function createOrder(ctx: MaintenanceActor, input: CreateOrderInput, deps: MaintenanceDeps) {
  await assertAssetUsable(deps, ctx.tenantId, input.assetId);
  const cost = input.cost ?? 0;
  if (cost < 0) throw invalid('cost cannot be negative');
  const created = await deps.orders.create(
    {
      tenantId: ctx.tenantId,
      assetId: input.assetId,
      type: input.type,
      priority: input.priority,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      scheduledFor: input.scheduledFor?.trim() || undefined,
      cost,
      assignedTo: input.assignedTo?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdBy: ctx.userId,
    } satisfies CreateOrderData,
  );
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: MAINTENANCE_ACTIONS.ORDER_CREATED,
    entityType: 'maintenanceOrder',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { assetId: created.assetId, type: created.type, priority: created.priority, title: created.title },
  });
  return created;
}

export async function getOrder(ctx: MaintenanceActor, id: string, deps: MaintenanceDeps) {
  const order = await deps.orders.findById(ctx.tenantId, id);
  if (!order) throw notFound('Maintenance order');
  return order;
}

export async function listOrders(ctx: MaintenanceActor, filters: OrderFilters, page: number, limit: number, sortBy: string, sortOrder: 'asc' | 'desc', deps: MaintenanceDeps) {
  return deps.orders.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
}

export interface UpdateOrderInput extends UpdateOrderData {
  expectedVersion: number;
}

const EDITABLE_STATUSES: MaintenanceOrderStatus[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD'];

export async function updateOrder(ctx: MaintenanceActor, id: string, input: UpdateOrderInput, deps: MaintenanceDeps) {
  const before = await deps.orders.findById(ctx.tenantId, id);
  if (!before) throw notFound('Maintenance order');
  if (!EDITABLE_STATUSES.includes(before.status)) {
    throw invalid(`Order in status ${before.status} cannot be edited`);
  }
  const { expectedVersion, ...fields } = input;
  if (fields.cost !== undefined && fields.cost < 0) throw invalid('cost cannot be negative');
  const updated = await deps.orders.update(ctx.tenantId, id, fields, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Maintenance order');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: MAINTENANCE_ACTIONS.ORDER_UPDATED,
    entityType: 'maintenanceOrder',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { title: before.title, priority: before.priority },
    after: { title: updated.title, priority: updated.priority },
  });
  return updated;
}

const TRANSITIONS: Record<MaintenanceOrderStatus, MaintenanceOrderStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const TRANSITION_ACTIONS = {
  IN_PROGRESS: MAINTENANCE_ACTIONS.ORDER_STARTED,
  ON_HOLD: MAINTENANCE_ACTIONS.ORDER_ON_HOLD,
  COMPLETED: MAINTENANCE_ACTIONS.ORDER_COMPLETED,
  CANCELLED: MAINTENANCE_ACTIONS.ORDER_CANCELLED,
} as const;

async function syncAssetStatus(deps: MaintenanceDeps, tenantId: string, assetId: string, updatedBy: string): Promise<void> {
  const open = await deps.orders.countOpenByAsset(tenantId, assetId);
  const asset = await deps.assets.findById(tenantId, assetId);
  if (!asset || asset.status === 'RETIRED' || asset.status === 'OUT_OF_SERVICE') return;
  const target: AssetStatus = open > 0 ? 'IN_MAINTENANCE' : 'ACTIVE';
  if (asset.status !== target) {
    await deps.assets.setStatus(tenantId, assetId, target, asset.version, updatedBy);
  }
}

export async function transitionOrder(
  ctx: MaintenanceActor,
  id: string,
  to: MaintenanceOrderStatus,
  expectedVersion: number,
  completedCost: number | undefined,
  deps: MaintenanceDeps,
) {
  const before = await deps.orders.findById(ctx.tenantId, id);
  if (!before) throw notFound('Maintenance order');
  if (!TRANSITIONS[before.status].includes(to)) {
    throw invalid(`Cannot transition order from ${before.status} to ${to}`, { from: before.status, to });
  }
  if (completedCost !== undefined && completedCost < 0) throw invalid('cost cannot be negative');
  const updated = await deps.orders.transition(ctx.tenantId, id, to, expectedVersion, ctx.userId, completedCost === undefined ? undefined : { completedCost });
  if (!updated) throw notFound('Maintenance order');
  await syncAssetStatus(deps, ctx.tenantId, updated.assetId, ctx.userId);
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: TRANSITION_ACTIONS[to as keyof typeof TRANSITION_ACTIONS] ?? MAINTENANCE_ACTIONS.ORDER_UPDATED,
    entityType: 'maintenanceOrder',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: before.status },
    after: { status: updated.status },
  });
  return updated;
}

export async function cancelOrder(ctx: MaintenanceActor, id: string, deps: MaintenanceDeps) {
  const order = await deps.orders.findById(ctx.tenantId, id);
  if (!order) throw notFound('Maintenance order');
  return transitionOrder(ctx, id, 'CANCELLED', order.version, undefined, deps);
}
