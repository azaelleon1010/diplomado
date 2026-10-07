/**
 * Supplier quote use cases: register, compare, award.
 *
 * Award = convert the approved request into a purchase order with the
 * winning prices + mark the quote AWARDED and the rest DISCARDED, in one
 * transaction.
 */
import { AppError } from '@erp/errors';
import { withTransaction } from '@erp/database';
import { sanitizeForAudit } from '../../identity/domain/entities';
import type { TxRunner, TxSession } from '../../identity/domain/ports';
import { PURCHASING_ACTIONS, type PurchaseOrder } from '../domain/entities';
import { QUOTE_FOLIO_PREFIX, type ISupplierQuoteStore, type SupplierQuote, type SupplierQuoteLine } from '../domain/quotes';
import type { PurchaseRequest } from '../domain/requests';
import { formatFolio } from '../../../shared/sequence';
import { assertSupplierUsable, type PurchasingActor } from './usecases';
import { convertRequestToOrder, getPurchaseRequest, type RequestDeps } from './requests';

export interface QuoteDeps extends RequestDeps {
  quotes: ISupplierQuoteStore;
}

const QUOTABLE: PurchaseRequest['status'][] = ['SUBMITTED', 'APPROVED'];

function invalid(message: string, fields?: Record<string, unknown>): AppError {
  return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}

function notFound(entity: string): AppError {
  return new AppError({ code: 'NOT_FOUND', message: `${entity} not found`, statusCode: 404 });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CreateQuoteInput {
  supplierId: string;
  currency?: string;
  validUntil?: string;
  notes?: string;
  lines: SupplierQuoteLine[];
}

export async function createSupplierQuote(ctx: PurchasingActor, requestId: string, input: CreateQuoteInput, deps: QuoteDeps): Promise<SupplierQuote> {
  const request = await getPurchaseRequest(ctx, requestId, deps);
  if (!QUOTABLE.includes(request.status)) throw invalid(`Request in status ${request.status} cannot receive quotes`);
  const supplier = await assertSupplierUsable(deps, ctx.tenantId, input.supplierId);
  if (await deps.quotes.findByRequestAndSupplier(ctx.tenantId, requestId, input.supplierId)) {
    throw new AppError({ code: 'CONFLICT', message: 'This supplier already quoted the request', statusCode: 409, fields: { duplicateFields: { supplierId: true } } });
  }

  const requested = new Map(request.lines.map((l) => [l.productId, l.quantity]));
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (!requested.has(line.productId)) throw invalid('Quoted product is not part of the request', { productId: line.productId });
    if (seen.has(line.productId)) throw invalid('Duplicate product in quote', { productId: line.productId });
    seen.add(line.productId);
  }
  const total = round2(input.lines.reduce((sum, l) => sum + l.unitCost * (l.quantity ?? requested.get(l.productId) ?? 0), 0));
  const folio = formatFolio(QUOTE_FOLIO_PREFIX, await deps.sequences.next(ctx.tenantId, 'supplierQuote'));
  const quote = await deps.quotes.create({
    tenantId: ctx.tenantId,
    folio,
    requestId,
    supplierId: input.supplierId,
    currency: (input.currency ?? supplier.currency ?? 'MXN').toUpperCase(),
    ...(input.validUntil?.trim() ? { validUntil: input.validUntil.trim() } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    lines: input.lines,
    total,
    createdBy: ctx.userId,
  });
  await deps.audit.record({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: PURCHASING_ACTIONS.QUOTE_RECEIVED,
    entityType: 'supplierQuote',
    entityId: quote._id,
    after: sanitizeForAudit({ folio, requestId, supplierId: input.supplierId, total }),
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
  });
  return quote;
}

export interface QuoteComparison {
  requestId: string;
  quotes: SupplierQuote[];
  /** Per requested product: every supplier price and the lowest one. */
  lines: Array<{
    productId: string;
    requestedQuantity: number;
    offers: Array<{ quoteId: string; supplierId: string; unitCost: number; quantity?: number; leadTimeDays?: number }>;
    bestQuoteId?: string;
  }>;
  /** Cheapest quote covering every requested product, if any. */
  bestCompleteQuoteId?: string;
}

export async function compareSupplierQuotes(ctx: PurchasingActor, requestId: string, deps: QuoteDeps): Promise<QuoteComparison> {
  const request = await getPurchaseRequest(ctx, requestId, deps);
  const quotes = await deps.quotes.listByRequest(ctx.tenantId, requestId);
  const lines = request.lines.map((line) => {
    const offers = quotes.flatMap((q) => {
      const offer = q.lines.find((l) => l.productId === line.productId);
      return offer ? [{ quoteId: q._id, supplierId: q.supplierId, unitCost: offer.unitCost, quantity: offer.quantity, leadTimeDays: offer.leadTimeDays }] : [];
    });
    const best = [...offers].sort((a, b) => a.unitCost - b.unitCost)[0];
    return { productId: line.productId, requestedQuantity: line.quantity, offers, ...(best ? { bestQuoteId: best.quoteId } : {}) };
  });
  const complete = quotes.filter((q) => request.lines.every((l) => q.lines.some((ql) => ql.productId === l.productId)));
  const bestComplete = [...complete].sort((a, b) => a.total - b.total)[0];
  return { requestId, quotes, lines, ...(bestComplete ? { bestCompleteQuoteId: bestComplete._id } : {}) };
}

export interface AwardQuoteInput {
  folio?: string;
  expectedDate?: string;
  expectedVersion: number;
}

export async function awardSupplierQuote(
  ctx: PurchasingActor,
  quoteId: string,
  input: AwardQuoteInput,
  deps: QuoteDeps,
): Promise<{ quote: SupplierQuote; order: PurchaseOrder; request: PurchaseRequest }> {
  const runTx: TxRunner = deps.tx ?? ((fn) => withTransaction((s) => fn(s as TxSession)));
  return runTx(async (session) => {
    const quote = await deps.quotes.findById(ctx.tenantId, quoteId, session);
    if (!quote) throw notFound('Supplier quote');
    if (quote.status !== 'RECEIVED') throw invalid(`Quote in status ${quote.status} cannot be awarded`);
    const request = await deps.requests.findById(ctx.tenantId, quote.requestId, session);
    if (!request) throw notFound('Purchase request');
    if (request.status !== 'APPROVED') throw invalid('Only approved requests can be awarded', { status: request.status });
    for (const line of request.lines) {
      if (!quote.lines.some((l) => l.productId === line.productId)) {
        throw invalid('The quote does not cover every requested product', { productId: line.productId });
      }
    }

    const { order, request: ordered } = await convertRequestToOrder(
      ctx,
      request._id,
      {
        supplierId: quote.supplierId,
        folio: input.folio,
        expectedDate: input.expectedDate,
        notes: `Adjudicada: ${quote.folio} / ${request.folio}`,
        lines: quote.lines.map((l) => ({ productId: l.productId, unitCost: l.unitCost, ...(l.quantity !== undefined ? { quantity: l.quantity } : {}) })),
        expectedVersion: request.version,
      },
      deps,
      session,
    );
    const awarded = await deps.quotes.award(ctx.tenantId, quote._id, request._id, order._id, input.expectedVersion, ctx.userId, session);
    if (!awarded) throw notFound('Supplier quote');
    await deps.audit.record(
      {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: PURCHASING_ACTIONS.QUOTE_AWARDED,
        entityType: 'supplierQuote',
        entityId: quote._id,
        after: sanitizeForAudit({ folio: quote.folio, purchaseOrderId: order._id, total: quote.total }),
        result: 'SUCCESS',
        correlationId: ctx.correlationId,
      },
      session,
    );
    return { quote: awarded, order, request: ordered };
  });
}
