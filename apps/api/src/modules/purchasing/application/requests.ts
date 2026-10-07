/**
 * Purchase request use cases: need → approval → purchase order.
 *
 * Conversion creates the purchase order (DRAFT) and marks the request as
 * ORDERED in one transaction, so a request is ordered at most once.
 */
import { AppError } from '@erp/errors';
import { withTransaction } from '@erp/database';
import { sanitizeForAudit } from '../../identity/domain/entities';
import type { TxRunner, TxSession } from '../../identity/domain/ports';
import { isValidQuantity } from '../../inventory/domain/stock';
import { PURCHASING_ACTIONS, type PurchaseOrder } from '../domain/entities';
import {
  ORDER_FOLIO_PREFIX,
  REQUEST_FOLIO_PREFIX,
  REQUEST_TRANSITIONS,
  type IPurchaseRequestStore,
  type PurchaseRequest,
  type PurchaseRequestFilters,
  type PurchaseRequestLine,
  type PurchaseRequestStatus,
} from '../domain/requests';
import { formatFolio, type ISequenceStore } from '../../../shared/sequence';
import { assertCatalogProduct, assertLines, assertSupplierUsable, type PurchasingActor, type PurchasingDeps } from './usecases';

export interface RequestDeps extends PurchasingDeps {
  requests: IPurchaseRequestStore;
  sequences: ISequenceStore;
  tx?: TxRunner;
}

function invalid(message: string, fields?: Record<string, unknown>): AppError {
  return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}

function notFound(entity: string): AppError {
  return new AppError({ code: 'NOT_FOUND', message: `${entity} not found`, statusCode: 404 });
}

async function audit(deps: RequestDeps, ctx: PurchasingActor, action: string, entityId: string, before: unknown, after: unknown, session?: TxSession, entityType = 'purchaseRequest') {
  await deps.audit.record(
    {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action,
      entityType,
      entityId,
      before: sanitizeForAudit(before),
      after: sanitizeForAudit(after),
      result: 'SUCCESS',
      correlationId: ctx.correlationId,
    },
    session,
  );
}

async function validateLines(ctx: PurchasingActor, lines: PurchaseRequestLine[], deps: RequestDeps): Promise<PurchaseRequestLine[]> {
  if (lines.length === 0) throw invalid('A request needs at least one line');
  const seen = new Set<string>();
  const normalized: PurchaseRequestLine[] = [];
  for (const line of lines) {
    if (seen.has(line.productId)) throw invalid('Duplicate product in request lines', { productId: line.productId });
    seen.add(line.productId);
    if (!isValidQuantity(line.quantity)) throw invalid('quantity must be positive with at most 3 decimals', { productId: line.productId });
    await assertCatalogProduct(deps, ctx.tenantId, line.productId);
    normalized.push({ productId: line.productId, quantity: line.quantity, ...(line.notes?.trim() ? { notes: line.notes.trim() } : {}) });
  }
  return normalized;
}

function assertTransition(request: PurchaseRequest, to: PurchaseRequestStatus): void {
  if (!REQUEST_TRANSITIONS[request.status].includes(to)) {
    throw invalid(`Cannot move request from ${request.status} to ${to}`, { from: request.status, to });
  }
}

export interface CreateRequestInput {
  department?: string;
  neededBy?: string;
  justification?: string;
  lines: PurchaseRequestLine[];
}

export async function createPurchaseRequest(ctx: PurchasingActor, input: CreateRequestInput, deps: RequestDeps) {
  const lines = await validateLines(ctx, input.lines, deps);
  const folio = formatFolio(REQUEST_FOLIO_PREFIX, await deps.sequences.next(ctx.tenantId, 'purchaseRequest'));
  const created = await deps.requests.create({
    tenantId: ctx.tenantId,
    folio,
    requestedBy: ctx.userId,
    ...(input.department?.trim() ? { department: input.department.trim() } : {}),
    ...(input.neededBy?.trim() ? { neededBy: input.neededBy.trim() } : {}),
    ...(input.justification?.trim() ? { justification: input.justification.trim() } : {}),
    lines,
  });
  await audit(deps, ctx, PURCHASING_ACTIONS.REQUEST_CREATED, created._id, undefined, { folio, lines: lines.length });
  return created;
}

export async function getPurchaseRequest(ctx: PurchasingActor, id: string, deps: RequestDeps) {
  const request = await deps.requests.findById(ctx.tenantId, id);
  if (!request) throw notFound('Purchase request');
  return request;
}

export function listPurchaseRequests(ctx: PurchasingActor, filters: PurchaseRequestFilters, page: number, limit: number, deps: RequestDeps) {
  return deps.requests.list(ctx.tenantId, filters, page, limit);
}

export interface UpdateRequestInput {
  department?: string | null;
  neededBy?: string | null;
  justification?: string | null;
  lines?: PurchaseRequestLine[];
  expectedVersion: number;
}

export async function updatePurchaseRequest(ctx: PurchasingActor, id: string, input: UpdateRequestInput, deps: RequestDeps) {
  const before = await getPurchaseRequest(ctx, id, deps);
  if (before.status !== 'DRAFT') throw invalid(`Request in status ${before.status} cannot be edited`);
  const { expectedVersion, lines, ...fields } = input;
  const patch = { ...fields, ...(lines !== undefined ? { lines: await validateLines(ctx, lines, deps) } : {}) };
  const updated = await deps.requests.updateDraft(ctx.tenantId, id, patch, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Purchase request');
  await audit(deps, ctx, PURCHASING_ACTIONS.REQUEST_UPDATED, id, { lines: before.lines.length }, { lines: updated.lines.length });
  return updated;
}

export async function submitPurchaseRequest(ctx: PurchasingActor, id: string, expectedVersion: number, deps: RequestDeps) {
  const before = await getPurchaseRequest(ctx, id, deps);
  assertTransition(before, 'SUBMITTED');
  const updated = await deps.requests.setStatus(ctx.tenantId, id, { status: 'SUBMITTED', submittedAt: new Date() }, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Purchase request');
  await audit(deps, ctx, PURCHASING_ACTIONS.REQUEST_SUBMITTED, id, { status: before.status }, { status: updated.status });
  return updated;
}

export async function decidePurchaseRequest(
  ctx: PurchasingActor,
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  expectedVersion: number,
  reason: string | undefined,
  deps: RequestDeps,
) {
  const before = await getPurchaseRequest(ctx, id, deps);
  assertTransition(before, decision);
  const trimmed = reason?.trim();
  if (decision === 'REJECTED' && !trimmed) throw invalid('A rejection requires a reason');
  const updated = await deps.requests.setStatus(
    ctx.tenantId,
    id,
    { status: decision, decidedBy: ctx.userId, decidedAt: new Date(), ...(trimmed ? { decisionReason: trimmed } : {}) },
    expectedVersion,
    ctx.userId,
  );
  if (!updated) throw notFound('Purchase request');
  await audit(
    deps,
    ctx,
    decision === 'APPROVED' ? PURCHASING_ACTIONS.REQUEST_APPROVED : PURCHASING_ACTIONS.REQUEST_REJECTED,
    id,
    { status: before.status },
    { status: updated.status, reason: trimmed },
  );
  return updated;
}

export async function cancelPurchaseRequest(ctx: PurchasingActor, id: string, deps: RequestDeps) {
  const before = await getPurchaseRequest(ctx, id, deps);
  assertTransition(before, 'CANCELLED');
  const updated = await deps.requests.setStatus(ctx.tenantId, id, { status: 'CANCELLED' }, before.version, ctx.userId);
  if (!updated) throw notFound('Purchase request');
  await audit(deps, ctx, PURCHASING_ACTIONS.REQUEST_CANCELLED, id, { status: before.status }, { status: updated.status });
  return updated;
}

export interface ConvertRequestInput {
  supplierId: string;
  folio?: string;
  expectedDate?: string;
  notes?: string;
  /** Prices per product; quantities default to the requested ones. */
  lines: Array<{ productId: string; unitCost: number; quantity?: number }>;
  expectedVersion: number;
}

async function nextOrderFolio(ctx: PurchasingActor, deps: RequestDeps, session: TxSession): Promise<string> {
  // Auto folios share the namespace with manual ones; skip any taken.
  for (let attempt = 0; attempt < 20; attempt++) {
    const folio = formatFolio(ORDER_FOLIO_PREFIX, await deps.sequences.next(ctx.tenantId, 'purchaseOrder', session));
    if (!(await deps.orders.findByFolio(ctx.tenantId, folio, session))) return folio;
  }
  throw new AppError({ code: 'CONFLICT', message: 'Could not allocate a purchase order folio', statusCode: 409 });
}

/**
 * Conversion core. Pass outerSession to run inside the caller transaction
 * (quote award); otherwise a new transaction is opened.
 */
export async function convertRequestToOrder(
  ctx: PurchasingActor,
  id: string,
  input: ConvertRequestInput,
  deps: RequestDeps,
  outerSession?: TxSession,
): Promise<{ request: PurchaseRequest; order: PurchaseOrder }> {
  const request = await deps.requests.findById(ctx.tenantId, id, outerSession);
  if (!request) throw notFound('Purchase request');
  assertTransition(request, 'ORDERED');
  await assertSupplierUsable(deps, ctx.tenantId, input.supplierId);

  const prices = new Map(input.lines.map((l) => [l.productId, l]));
  for (const productId of prices.keys()) {
    if (!request.lines.some((l) => l.productId === productId)) throw invalid('Product is not part of the request', { productId });
  }
  const lines = request.lines.map((line) => {
    const priced = prices.get(line.productId);
    if (!priced) throw invalid('Every requested product needs a unit cost', { productId: line.productId });
    return { productId: line.productId, quantity: priced.quantity ?? line.quantity, unitCost: priced.unitCost };
  });
  assertLines(lines);
  for (const line of lines) await assertCatalogProduct(deps, ctx.tenantId, line.productId);

  const run = async (session: TxSession) => {
    const folio = input.folio?.trim() ? input.folio.trim().toUpperCase() : await nextOrderFolio(ctx, deps, session);
    if (input.folio?.trim() && (await deps.orders.findByFolio(ctx.tenantId, folio, session))) {
      throw new AppError({ code: 'CONFLICT', message: 'Duplicate value for folio', statusCode: 409, fields: { duplicateFields: { folio: true } } });
    }
    const order = await deps.orders.create(
      {
        tenantId: ctx.tenantId,
        folio,
        supplierId: input.supplierId,
        ...(input.expectedDate?.trim() ? { expectedDate: input.expectedDate.trim() } : {}),
        notes: input.notes?.trim() || `Generada desde ${request.folio}`,
        lines,
        requestId: request._id,
        createdBy: ctx.userId,
      },
      session,
    );
    const updated = await deps.requests.setStatus(ctx.tenantId, id, { status: 'ORDERED', purchaseOrderId: order._id }, input.expectedVersion, ctx.userId, session);
    if (!updated) throw notFound('Purchase request');
    await audit(deps, ctx, PURCHASING_ACTIONS.REQUEST_ORDERED, id, { status: request.status }, { status: 'ORDERED', purchaseOrderId: order._id, folio }, session);
    await audit(deps, ctx, PURCHASING_ACTIONS.ORDER_CREATED, order._id, undefined, { folio, requestId: request._id, subtotal: order.subtotal }, session, 'purchaseOrder');
    return { request: updated, order };
  };
  if (outerSession !== undefined) return run(outerSession);
  const runTx: TxRunner = deps.tx ?? ((fn) => withTransaction((s) => fn(s as TxSession)));
  return runTx(run);
}
