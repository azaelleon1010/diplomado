/**
 * Goods receipt use cases: Purchasing → Inventory integration.
 *
 * One transaction writes: the inventory posting (RECEIPT movements at the
 * order cost), the purchase order received quantities + derived status, the
 * immutable receipt document, the idempotency record and the audit event.
 * Either all of it commits or nothing does.
 */
import { AppError } from '@erp/errors';
import { withTransaction } from '@erp/database';
import { sanitizeForAudit } from '../../identity/domain/entities';
import type { IAuditSink, TxRunner, TxSession } from '../../identity/domain/ports';
import { postStockMovements, type StockDeps } from '../../inventory/application/stock';
import { isValidQuantity, roundQuantity } from '../../inventory/domain/stock';
import type { IProductStore } from '../../inventory/domain/ports';
import { PURCHASING_ACTIONS, type PurchaseOrder, type PurchaseOrderStatus } from '../domain/entities';
import type { IPurchaseOrderStore } from '../domain/ports';
import { RECEIPT_FOLIO_PREFIX, type GoodsReceipt, type GoodsReceiptFilters, type IGoodsReceiptStore } from '../domain/receipts';
import { IDEMPOTENCY_KEY_PATTERN, hashRequest, idempotencyConflict, type IIdempotencyStore } from '../../../shared/idempotency';
import { formatFolio, type ISequenceStore } from '../../../shared/sequence';

export interface ReceiptDeps {
  orders: IPurchaseOrderStore;
  receipts: IGoodsReceiptStore;
  products: Pick<IProductStore, 'findById'>;
  stock: StockDeps;
  sequences: ISequenceStore;
  idempotency: IIdempotencyStore;
  audit: IAuditSink;
  tx?: TxRunner;
}

export interface ReceiptActor {
  userId: string;
  tenantId: string;
  correlationId?: string;
}

export interface ReceiveInput {
  warehouseId: string;
  lines: Array<{ productId: string; quantity: number }>;
  notes?: string;
  idempotencyKey: string;
}

export interface ReceiveResult {
  receipt: GoodsReceipt;
  order: PurchaseOrder;
  replayed: boolean;
}

const RECEIVABLE: PurchaseOrderStatus[] = ['APPROVED', 'PARTIALLY_RECEIVED'];
const SCOPE = 'purchasing.receipt';

function invalid(message: string, fields?: Record<string, unknown>): AppError {
  return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}

function notFound(entity: string): AppError {
  return new AppError({ code: 'NOT_FOUND', message: `${entity} not found`, statusCode: 404 });
}

async function receiveInSession(ctx: ReceiptActor, orderId: string, input: ReceiveInput, deps: ReceiptDeps, session: TxSession): Promise<ReceiveResult> {
  const requestHash = hashRequest({ orderId, warehouseId: input.warehouseId, lines: input.lines, notes: input.notes });
  const previous = await deps.idempotency.find(ctx.tenantId, SCOPE, input.idempotencyKey, session);
  if (previous) {
    if (previous.requestHash !== requestHash) throw idempotencyConflict();
    const receipt = await deps.receipts.findById(ctx.tenantId, previous.resultRef, session);
    const order = await deps.orders.findById(ctx.tenantId, orderId, session);
    if (!receipt || !order) throw notFound('Goods receipt');
    return { receipt, order, replayed: true };
  }

  const order = await deps.orders.findById(ctx.tenantId, orderId, session);
  if (!order) throw notFound('Purchase order');
  if (!RECEIVABLE.includes(order.status)) {
    throw invalid(`Order in status ${order.status} cannot be received`, { status: order.status });
  }

  // Aggregate repeated products, then check against the remaining quantity.
  const requested = new Map<string, number>();
  for (const line of input.lines) {
    if (!isValidQuantity(line.quantity)) throw invalid('quantity must be positive with at most 3 decimals', { productId: line.productId });
    requested.set(line.productId, roundQuantity((requested.get(line.productId) ?? 0) + line.quantity));
  }
  const orderLines = new Map(order.lines.map((l) => [l.productId, l]));
  const receiptLines: GoodsReceipt['lines'] = [];
  for (const [productId, quantity] of requested) {
    const line = orderLines.get(productId);
    if (!line) throw invalid('Product is not part of the purchase order', { productId });
    const remaining = roundQuantity(line.quantity - line.quantityReceived);
    if (quantity > remaining) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Received quantity exceeds the pending quantity of the order',
        statusCode: 400,
        fields: { productId, pending: remaining, requested: quantity },
      });
    }
    const product = await deps.products.findById(ctx.tenantId, productId, session);
    receiptLines.push({ productId, quantity, unitCost: line.unitCost, stocked: Boolean(product?.trackInventory) });
  }

  const receiptId = deps.receipts.newId();
  const folio = formatFolio(RECEIPT_FOLIO_PREFIX, await deps.sequences.next(ctx.tenantId, 'goodsReceipt', session));

  const stockLines = receiptLines
    .filter((l) => l.stocked)
    .map((l) => ({ productId: l.productId, warehouseId: input.warehouseId, type: 'RECEIPT' as const, quantity: l.quantity, unitCost: l.unitCost }));
  let postingId: string | undefined;
  if (stockLines.length > 0) {
    const posting = await postStockMovements(
      ctx,
      {
        lines: stockLines,
        source: { type: 'PURCHASE_RECEIPT', id: receiptId, reference: `${folio} / ${order.folio}` },
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        idempotencyScope: `${SCOPE}.stock`,
      },
      deps.stock,
      session,
    );
    postingId = posting.postingId;
  } else {
    // Still validate the warehouse even if nothing is stocked.
    const warehouse = await deps.stock.warehouses.findById(ctx.tenantId, input.warehouseId, session);
    if (!warehouse || warehouse.status !== 'ACTIVE') throw invalid('Warehouse is not active', { warehouseId: input.warehouseId });
  }

  const delta = Object.fromEntries(receiptLines.map((l) => [l.productId, l.quantity]));
  const fullyReceived = order.lines.every((l) => roundQuantity(l.quantityReceived + (delta[l.productId] ?? 0)) >= l.quantity);
  const updatedOrder = await deps.orders.applyReceipt(
    ctx.tenantId,
    order._id,
    delta,
    fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
    order.version,
    ctx.userId,
    session,
  );
  if (!updatedOrder) throw notFound('Purchase order');

  const total = Math.round(receiptLines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0) * 100) / 100;
  const receipt = await deps.receipts.create(
    {
      _id: receiptId,
      tenantId: ctx.tenantId,
      folio,
      purchaseOrderId: order._id,
      purchaseOrderFolio: order.folio,
      supplierId: order.supplierId,
      warehouseId: input.warehouseId,
      status: 'POSTED',
      lines: receiptLines,
      total,
      ...(postingId ? { postingId } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      receivedAt: new Date(),
      createdBy: ctx.userId,
    },
    session,
  );

  await deps.idempotency.save({ tenantId: ctx.tenantId, scope: SCOPE, key: input.idempotencyKey, requestHash, resultRef: receipt._id, createdBy: ctx.userId }, session);
  await deps.audit.record(
    {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: PURCHASING_ACTIONS.RECEIPT_POSTED,
      entityType: 'goodsReceipt',
      entityId: receipt._id,
      before: sanitizeForAudit({ orderStatus: order.status }),
      after: sanitizeForAudit({ folio, order: order.folio, orderStatus: updatedOrder.status, total, postingId, lines: receiptLines.length }),
      result: 'SUCCESS',
      correlationId: ctx.correlationId,
    },
    session,
  );

  return { receipt, order: updatedOrder, replayed: false };
}

export async function receivePurchaseOrder(ctx: ReceiptActor, orderId: string, input: ReceiveInput, deps: ReceiptDeps): Promise<ReceiveResult> {
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
    throw invalid('idempotencyKey must be 8-128 characters: letters, digits, . _ : -');
  }
  if (input.lines.length === 0 || input.lines.length > 200) throw invalid('A receipt needs between 1 and 200 lines');
  const runTx: TxRunner = deps.tx ?? ((fn) => withTransaction((s) => fn(s as TxSession)));
  return runTx((session) => receiveInSession(ctx, orderId, input, deps, session));
}

export async function getGoodsReceipt(ctx: ReceiptActor, id: string, deps: Pick<ReceiptDeps, 'receipts'>) {
  const receipt = await deps.receipts.findById(ctx.tenantId, id);
  if (!receipt) throw notFound('Goods receipt');
  return receipt;
}

export function listGoodsReceipts(ctx: ReceiptActor, filters: GoodsReceiptFilters, page: number, limit: number, deps: Pick<ReceiptDeps, 'receipts'>) {
  return deps.receipts.list(ctx.tenantId, filters, page, limit);
}
