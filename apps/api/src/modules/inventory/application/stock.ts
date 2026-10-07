/**
 * Inventory ledger use cases.
 *
 * postStockMovements is the single entry point that changes stock. It runs
 * the balance updates, the immutable movements, the idempotency record and
 * the audit event in ONE transaction (the caller's session when another
 * module posts as part of its own document, e.g. a purchase receipt).
 *
 * Permission rules live in the HTTP-facing use cases (manual movements,
 * transfers); module integrations are authorized by their own permissions.
 */
import { randomUUID } from 'node:crypto';
import { AppError } from '@erp/errors';
import { withTransaction } from '@erp/database';
import { sanitizeForAudit } from '../../identity/domain/entities';
import { PERMISSIONS, hasPermission } from '../../identity/domain/permissions';
import type { IAuditSink, TxRunner, TxSession } from '../../identity/domain/ports';
import { INVENTORY_ACTIONS } from '../domain/entities';
import type { IProductStore, IWarehouseStore } from '../domain/ports';
import {
  STOCK_DIRECTION,
  isValidQuantity,
  roundQuantity,
  type IStockLedger,
  type StockBalanceFilters,
  type StockMovement,
  type StockMovementFilters,
  type StockMovementType,
  type StockSource,
} from '../domain/stock';
import {
  IDEMPOTENCY_KEY_PATTERN,
  hashRequest,
  idempotencyConflict,
  type IIdempotencyStore,
} from '../../../shared/idempotency';

export interface StockDeps {
  ledger: IStockLedger;
  products: Pick<IProductStore, 'findById'>;
  warehouses: Pick<IWarehouseStore, 'findById'>;
  idempotency: IIdempotencyStore;
  audit: IAuditSink;
  /** Defaults to withTransaction; injectable for unit tests. */
  tx?: TxRunner;
}

export interface StockActor {
  userId: string;
  tenantId: string;
  correlationId?: string;
  /** Server-resolved grants (req.grantedPermissions). */
  permissions: readonly string[];
}

export interface StockLineInput {
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  quantity: number;
  unitCost?: number;
}

export interface PostStockInput {
  lines: StockLineInput[];
  source: StockSource;
  notes?: string;
  idempotencyKey: string;
  /** Namespace for the key; each integrating document type uses its own. */
  idempotencyScope?: string;
}

export interface PostStockResult {
  postingId: string;
  movements: StockMovement[];
  /** True when the request was a retry and nothing new was written. */
  replayed: boolean;
}

export const MAX_LINES_PER_POSTING = 100;

const MANUAL_TYPE_PERMISSION: Readonly<Partial<Record<StockMovementType, string>>> = {
  RECEIPT: PERMISSIONS.INVENTORY_STOCK_IN,
  ISSUE: PERMISSIONS.INVENTORY_STOCK_OUT,
  ADJUSTMENT_IN: PERMISSIONS.INVENTORY_STOCK_ADJUST,
  ADJUSTMENT_OUT: PERMISSIONS.INVENTORY_STOCK_ADJUST,
};

function invalid(message: string, fields?: Record<string, unknown>): AppError {
  return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}

function forbidden(message: string): AppError {
  return new AppError({ code: 'FORBIDDEN', message, statusCode: 403 });
}

function validateInput(input: PostStockInput): void {
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
    throw invalid('idempotencyKey must be 8-128 characters: letters, digits, . _ : -');
  }
  if (input.lines.length === 0 || input.lines.length > MAX_LINES_PER_POSTING) {
    throw invalid(`A posting needs between 1 and ${MAX_LINES_PER_POSTING} lines`);
  }
  input.lines.forEach((line, index) => {
    if (!isValidQuantity(line.quantity)) {
      throw invalid('quantity must be positive with at most 3 decimals', { line: index });
    }
    if (line.unitCost !== undefined && (!Number.isFinite(line.unitCost) || line.unitCost < 0)) {
      throw invalid('unitCost cannot be negative', { line: index });
    }
  });
}

async function assertLinesUsable(ctx: { tenantId: string }, lines: StockLineInput[], deps: StockDeps, session: TxSession): Promise<void> {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const warehouseIds = [...new Set(lines.map((l) => l.warehouseId))];
  for (const id of productIds) {
    const product = await deps.products.findById(ctx.tenantId, id, session);
    if (!product) throw new AppError({ code: 'NOT_FOUND', message: 'Product not found', statusCode: 404, fields: { productId: id } });
    if (product.status !== 'ACTIVE') throw invalid('Product is not active', { productId: id });
    if (!product.trackInventory) throw invalid('Product does not track inventory', { productId: id });
  }
  for (const id of warehouseIds) {
    const warehouse = await deps.warehouses.findById(ctx.tenantId, id, session);
    if (!warehouse) throw new AppError({ code: 'NOT_FOUND', message: 'Warehouse not found', statusCode: 404, fields: { warehouseId: id } });
    if (warehouse.status !== 'ACTIVE') throw invalid('Warehouse is not active', { warehouseId: id });
  }
}

async function postInSession(
  ctx: { tenantId: string; userId: string; correlationId?: string },
  input: PostStockInput,
  deps: StockDeps,
  session: TxSession,
): Promise<PostStockResult> {
  const scope = input.idempotencyScope ?? 'inventory.stock';
  const requestHash = hashRequest({ lines: input.lines, source: input.source, notes: input.notes });

  const previous = await deps.idempotency.find(ctx.tenantId, scope, input.idempotencyKey, session);
  if (previous) {
    if (previous.requestHash !== requestHash) throw idempotencyConflict();
    return {
      postingId: previous.resultRef,
      movements: await deps.ledger.findMovementsByPosting(ctx.tenantId, previous.resultRef, session),
      replayed: true,
    };
  }

  await assertLinesUsable(ctx, input.lines, deps, session);

  const postingId = randomUUID();
  const pending: Array<Omit<StockMovement, '_id' | 'createdAt'>> = [];
  for (const line of input.lines) {
    const direction = STOCK_DIRECTION[line.type];
    const quantity = roundQuantity(line.quantity);
    let balanceAfter: number;
    if (direction === 'IN') {
      balanceAfter = await deps.ledger.increase(ctx.tenantId, line.productId, line.warehouseId, quantity, ctx.userId, session);
    } else {
      const decreased = await deps.ledger.decrease(ctx.tenantId, line.productId, line.warehouseId, quantity, ctx.userId, session);
      if (decreased === null) {
        const available = await deps.ledger.currentBalance(ctx.tenantId, line.productId, line.warehouseId, session);
        throw new AppError({
          code: 'INSUFFICIENT_STOCK',
          message: 'Insufficient stock for this movement',
          statusCode: 409,
          fields: { productId: line.productId, warehouseId: line.warehouseId, available, requested: quantity },
        });
      }
      balanceAfter = decreased;
    }
    pending.push({
      tenantId: ctx.tenantId,
      postingId,
      productId: line.productId,
      warehouseId: line.warehouseId,
      type: line.type,
      direction,
      quantity,
      ...(line.unitCost !== undefined ? { unitCost: line.unitCost } : {}),
      balanceAfter,
      source: input.source,
      ...(input.notes ? { notes: input.notes } : {}),
      createdBy: ctx.userId,
    });
  }

  const movements = await deps.ledger.insertMovements(pending, session);
  await deps.idempotency.save(
    { tenantId: ctx.tenantId, scope, key: input.idempotencyKey, requestHash, resultRef: postingId, createdBy: ctx.userId },
    session,
  );
  await deps.audit.record(
    {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: INVENTORY_ACTIONS.STOCK_POSTED,
      entityType: 'stockPosting',
      entityId: postingId,
      after: sanitizeForAudit({
        source: input.source,
        lines: movements.map((m) => ({ productId: m.productId, warehouseId: m.warehouseId, type: m.type, quantity: m.quantity, balanceAfter: m.balanceAfter })),
      }),
      result: 'SUCCESS',
      correlationId: ctx.correlationId,
    },
    session,
  );

  return { postingId, movements, replayed: false };
}

/**
 * Core ledger write. Pass `session` to join the caller's transaction;
 * otherwise a new transaction is opened.
 */
export async function postStockMovements(
  ctx: { tenantId: string; userId: string; correlationId?: string },
  input: PostStockInput,
  deps: StockDeps,
  session?: TxSession,
): Promise<PostStockResult> {
  validateInput(input);
  if (session !== undefined) return postInSession(ctx, input, deps, session);
  const runTx: TxRunner = deps.tx ?? ((fn) => withTransaction((s) => fn(s as TxSession)));
  return runTx((s) => postInSession(ctx, input, deps, s));
}

export interface ManualMovementInput {
  lines: StockLineInput[];
  reference?: string;
  notes?: string;
  idempotencyKey: string;
}

/** Receipts, issues and adjustments entered by a user (no source document). */
export async function postManualMovements(ctx: StockActor, input: ManualMovementInput, deps: StockDeps): Promise<PostStockResult> {
  for (const line of input.lines) {
    const required = MANUAL_TYPE_PERMISSION[line.type];
    if (!required) throw invalid('Transfers must use the transfer endpoint', { type: line.type });
    if (!hasPermission(ctx.permissions, required)) throw forbidden(`Missing permission ${required}`);
  }
  return postStockMovements(
    ctx,
    {
      lines: input.lines,
      source: { type: 'MANUAL', ...(input.reference ? { reference: input.reference } : {}) },
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
    },
    deps,
  );
}

export interface TransferInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reference?: string;
  notes?: string;
  idempotencyKey: string;
}

/** Moves stock between warehouses atomically (OUT + IN in one posting). */
export async function transferStock(ctx: StockActor, input: TransferInput, deps: StockDeps): Promise<PostStockResult> {
  if (!hasPermission(ctx.permissions, PERMISSIONS.INVENTORY_TRANSFER)) {
    throw forbidden(`Missing permission ${PERMISSIONS.INVENTORY_TRANSFER}`);
  }
  if (input.fromWarehouseId === input.toWarehouseId) throw invalid('Source and destination warehouses must differ');
  return postStockMovements(
    ctx,
    {
      lines: [
        { productId: input.productId, warehouseId: input.fromWarehouseId, type: 'TRANSFER_OUT', quantity: input.quantity },
        { productId: input.productId, warehouseId: input.toWarehouseId, type: 'TRANSFER_IN', quantity: input.quantity },
      ],
      source: { type: 'TRANSFER', ...(input.reference ? { reference: input.reference } : {}) },
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
      idempotencyScope: 'inventory.transfer',
    },
    deps,
  );
}

export function listStockBalances(ctx: { tenantId: string }, filters: StockBalanceFilters, page: number, limit: number, deps: Pick<StockDeps, 'ledger'>) {
  return deps.ledger.listBalances(ctx.tenantId, filters, page, limit);
}

export function listStockMovements(ctx: { tenantId: string }, filters: StockMovementFilters, page: number, limit: number, deps: Pick<StockDeps, 'ledger'>) {
  return deps.ledger.listMovements(ctx.tenantId, filters, page, limit);
}
