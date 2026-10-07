/**
 * Supplier invoice (accounts payable) use cases with three-way match.
 *
 * Registration runs in one transaction: idempotency, match checks, the
 * invoice and the purchase order invoiced quantities (version-guarded, so
 * two concurrent invoices cannot both bill the same received goods).
 */
import { AppError } from '@erp/errors';
import { withTransaction } from '@erp/database';
import { sanitizeForAudit } from '../../identity/domain/entities';
import type { IAuditSink, TxRunner, TxSession } from '../../identity/domain/ports';
import { isValidQuantity, roundQuantity } from '../../inventory/domain/stock';
import { PURCHASING_ACTIONS } from '../domain/entities';
import type { IPurchaseOrderStore, ISupplierStore } from '../domain/ports';
import {
  AGING_BUCKETS,
  INVOICE_FOLIO_PREFIX,
  PRICE_TOLERANCE,
  addDays,
  agingBucket,
  type AgingBucket,
  type ISupplierInvoiceStore,
  type MatchIssue,
  type SupplierInvoice,
  type SupplierInvoiceFilters,
} from '../domain/invoices';
import { IDEMPOTENCY_KEY_PATTERN, hashRequest, idempotencyConflict, type IIdempotencyStore } from '../../../shared/idempotency';
import { formatFolio, type ISequenceStore } from '../../../shared/sequence';

export interface InvoiceDeps {
  invoices: ISupplierInvoiceStore;
  orders: IPurchaseOrderStore;
  suppliers: ISupplierStore;
  sequences: ISequenceStore;
  idempotency: IIdempotencyStore;
  audit: IAuditSink;
  tx?: TxRunner;
  /** Injectable clock for aging. */
  now?: () => Date;
}

export interface InvoiceActor {
  userId: string;
  tenantId: string;
  correlationId?: string;
}

const SCOPE = 'purchasing.invoice';
const round2 = (n: number) => Math.round(n * 100) / 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function invalid(message: string, fields?: Record<string, unknown>): AppError {
  return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}

function notFound(entity: string): AppError {
  return new AppError({ code: 'NOT_FOUND', message: `${entity} not found`, statusCode: 404 });
}

function runIn(deps: InvoiceDeps) {
  return deps.tx ?? (((fn) => withTransaction((s) => fn(s as TxSession))) as TxRunner);
}

async function audit(deps: InvoiceDeps, ctx: InvoiceActor, action: string, invoice: SupplierInvoice, before: unknown, after: unknown, session?: TxSession) {
  await deps.audit.record(
    {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action,
      entityType: 'supplierInvoice',
      entityId: invoice._id,
      before: sanitizeForAudit(before),
      after: sanitizeForAudit(after),
      result: 'SUCCESS',
      correlationId: ctx.correlationId,
    },
    session,
  );
}

export interface RegisterInvoiceInput {
  purchaseOrderId: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  taxRate?: number;
  notes?: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number }>;
  idempotencyKey: string;
}

export async function registerSupplierInvoice(
  ctx: InvoiceActor,
  input: RegisterInvoiceInput,
  deps: InvoiceDeps,
): Promise<{ invoice: SupplierInvoice; replayed: boolean }> {
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) throw invalid('idempotencyKey must be 8-128 characters: letters, digits, . _ : -');
  if (!ISO_DATE.test(input.invoiceDate)) throw invalid('invoiceDate must be YYYY-MM-DD');
  const taxRate = input.taxRate ?? 0;
  if (!(taxRate >= 0 && taxRate <= 1)) throw invalid('taxRate must be between 0 and 1');
  if (input.lines.length === 0) throw invalid('An invoice needs at least one line');

  return runIn(deps)(async (session) => {
    const requestHash = hashRequest(input);
    const previous = await deps.idempotency.find(ctx.tenantId, SCOPE, input.idempotencyKey, session);
    if (previous) {
      if (previous.requestHash !== requestHash) throw idempotencyConflict();
      const invoice = await deps.invoices.findById(ctx.tenantId, previous.resultRef, session);
      if (!invoice) throw notFound('Supplier invoice');
      return { invoice, replayed: true };
    }

    const order = await deps.orders.findById(ctx.tenantId, input.purchaseOrderId, session);
    if (!order) throw notFound('Purchase order');
    const supplier = await deps.suppliers.findById(ctx.tenantId, order.supplierId, session);
    if (!supplier) throw notFound('Supplier');
    const number = input.supplierInvoiceNumber.trim().toUpperCase();
    if (await deps.invoices.findBySupplierNumber(ctx.tenantId, order.supplierId, number, session)) {
      throw new AppError({ code: 'CONFLICT', message: 'This supplier invoice number is already registered', statusCode: 409, fields: { duplicateFields: { supplierInvoiceNumber: true } } });
    }

    const orderLines = new Map(order.lines.map((l) => [l.productId, l]));
    const seen = new Set<string>();
    const lines: SupplierInvoice['lines'] = [];
    const issues: MatchIssue[] = [];
    for (const line of input.lines) {
      if (seen.has(line.productId)) throw invalid('Duplicate product in invoice', { productId: line.productId });
      seen.add(line.productId);
      const ordered = orderLines.get(line.productId);
      if (!ordered) throw invalid('Invoiced product is not part of the purchase order', { productId: line.productId });
      if (!isValidQuantity(line.quantity)) throw invalid('quantity must be positive with at most 3 decimals', { productId: line.productId });
      if (!(line.unitCost >= 0)) throw invalid('unitCost cannot be negative', { productId: line.productId });
      // Three-way match, quantity: only goods received and not yet billed.
      const billable = roundQuantity(ordered.quantityReceived - ordered.quantityInvoiced);
      if (line.quantity > billable) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Invoiced quantity exceeds received and not yet invoiced quantity (three-way match)',
          statusCode: 400,
          fields: { productId: line.productId, billable, requested: line.quantity, received: ordered.quantityReceived, invoiced: ordered.quantityInvoiced },
        });
      }
      // Three-way match, price: variance above tolerance → hold.
      const variance = ordered.unitCost === 0 ? (line.unitCost === 0 ? 0 : 1) : Math.abs(line.unitCost - ordered.unitCost) / ordered.unitCost;
      if (variance > PRICE_TOLERANCE) {
        issues.push({ productId: line.productId, type: 'PRICE_VARIANCE', orderUnitCost: ordered.unitCost, invoiceUnitCost: line.unitCost, variancePct: Math.round(variance * 10000) / 100 });
      }
      lines.push({ productId: line.productId, quantity: line.quantity, unitCost: line.unitCost, orderUnitCost: ordered.unitCost });
    }

    const subtotal = round2(lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0));
    const taxAmount = round2(subtotal * taxRate);
    const total = round2(subtotal + taxAmount);
    const folio = formatFolio(INVOICE_FOLIO_PREFIX, await deps.sequences.next(ctx.tenantId, 'supplierInvoice', session));

    await deps.orders.applyInvoice(ctx.tenantId, order._id, Object.fromEntries(lines.map((l) => [l.productId, l.quantity])), order.version, ctx.userId, session);
    const invoice = await deps.invoices.create(
      {
        tenantId: ctx.tenantId,
        folio,
        supplierInvoiceNumber: number,
        supplierId: order.supplierId,
        purchaseOrderId: order._id,
        purchaseOrderFolio: order.folio,
        currency: supplier.currency,
        invoiceDate: input.invoiceDate,
        dueDate: addDays(input.invoiceDate, supplier.paymentTermsDays),
        lines,
        subtotal,
        taxRate,
        taxAmount,
        total,
        amountPaid: 0,
        balance: total,
        status: issues.length > 0 ? 'ON_HOLD' : 'POSTED',
        matchIssues: issues,
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        createdBy: ctx.userId,
      },
      session,
    );
    await deps.idempotency.save({ tenantId: ctx.tenantId, scope: SCOPE, key: input.idempotencyKey, requestHash, resultRef: invoice._id, createdBy: ctx.userId }, session);
    await audit(
      deps,
      ctx,
      issues.length > 0 ? PURCHASING_ACTIONS.INVOICE_HELD : PURCHASING_ACTIONS.INVOICE_POSTED,
      invoice,
      undefined,
      { folio, number, order: order.folio, total, status: invoice.status, issues: issues.length },
      session,
    );
    return { invoice, replayed: false };
  });
}

export async function releaseSupplierInvoice(ctx: InvoiceActor, id: string, expectedVersion: number, deps: InvoiceDeps) {
  const invoice = await deps.invoices.findById(ctx.tenantId, id);
  if (!invoice) throw notFound('Supplier invoice');
  if (invoice.status !== 'ON_HOLD') throw invalid(`Invoice in status ${invoice.status} is not on hold`);
  const updated = await deps.invoices.setStatus(ctx.tenantId, id, { status: 'POSTED', releasedBy: ctx.userId, releasedAt: new Date() }, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Supplier invoice');
  await audit(deps, ctx, PURCHASING_ACTIONS.INVOICE_RELEASED, updated, { status: invoice.status, issues: invoice.matchIssues }, { status: updated.status });
  return updated;
}

export async function cancelSupplierInvoice(ctx: InvoiceActor, id: string, expectedVersion: number, reason: string, deps: InvoiceDeps) {
  if (!reason.trim()) throw invalid('A cancellation requires a reason');
  return runIn(deps)(async (session) => {
    const invoice = await deps.invoices.findById(ctx.tenantId, id, session);
    if (!invoice) throw notFound('Supplier invoice');
    if (!['ON_HOLD', 'POSTED'].includes(invoice.status) || invoice.amountPaid > 0) {
      throw invalid(`Invoice in status ${invoice.status} with payments cannot be cancelled`);
    }
    const order = await deps.orders.findById(ctx.tenantId, invoice.purchaseOrderId, session);
    if (!order) throw notFound('Purchase order');
    // Give the billed quantities back so a corrected invoice can be registered.
    await deps.orders.applyInvoice(ctx.tenantId, order._id, Object.fromEntries(invoice.lines.map((l) => [l.productId, -l.quantity])), order.version, ctx.userId, session);
    const updated = await deps.invoices.setStatus(ctx.tenantId, id, { status: 'CANCELLED' }, expectedVersion, ctx.userId, session);
    if (!updated) throw notFound('Supplier invoice');
    await audit(deps, ctx, PURCHASING_ACTIONS.INVOICE_CANCELLED, updated, { status: invoice.status, balance: invoice.balance }, { status: 'CANCELLED', reason: reason.trim() }, session);
    return updated;
  });
}

export async function getSupplierInvoice(ctx: InvoiceActor, id: string, deps: Pick<InvoiceDeps, 'invoices'>) {
  const invoice = await deps.invoices.findById(ctx.tenantId, id);
  if (!invoice) throw notFound('Supplier invoice');
  return invoice;
}

export function listSupplierInvoices(ctx: InvoiceActor, filters: SupplierInvoiceFilters, page: number, limit: number, deps: Pick<InvoiceDeps, 'invoices'>) {
  return deps.invoices.list(ctx.tenantId, filters, page, limit);
}

type Buckets = Record<AgingBucket, number>;
const emptyBuckets = (): Buckets => Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Buckets;

export interface PayablesSummary {
  asOf: string;
  /** Per currency: never add amounts in different currencies. */
  totals: Array<{ currency: string; open: number; overdue: number; buckets: Buckets; invoices: number }>;
  bySupplier: Array<{ supplierId: string; currency: string; open: number; overdue: number; buckets: Buckets; invoices: number; nextDueDate?: string }>;
}

/** Open balances and aging (current, 1-30, 31-60, 61-90, 90+ days past due). */
export async function payablesSummary(ctx: InvoiceActor, supplierId: string | undefined, deps: Pick<InvoiceDeps, 'invoices' | 'now'>): Promise<PayablesSummary> {
  const today = deps.now?.() ?? new Date();
  const open = await deps.invoices.listOpen(ctx.tenantId, supplierId);
  const totals = new Map<string, PayablesSummary['totals'][number]>();
  const bySupplier = new Map<string, PayablesSummary['bySupplier'][number]>();
  for (const invoice of open) {
    const bucket = agingBucket(invoice.dueDate, today);
    const total = totals.get(invoice.currency) ?? { currency: invoice.currency, open: 0, overdue: 0, buckets: emptyBuckets(), invoices: 0 };
    const key = `${invoice.supplierId}|${invoice.currency}`;
    const supplier = bySupplier.get(key) ?? { supplierId: invoice.supplierId, currency: invoice.currency, open: 0, overdue: 0, buckets: emptyBuckets(), invoices: 0 };
    for (const row of [total, supplier]) {
      row.open = round2(row.open + invoice.balance);
      if (bucket !== 'current') row.overdue = round2(row.overdue + invoice.balance);
      row.buckets[bucket] = round2(row.buckets[bucket] + invoice.balance);
      row.invoices += 1;
    }
    if (!supplier.nextDueDate || invoice.dueDate < supplier.nextDueDate) supplier.nextDueDate = invoice.dueDate;
    totals.set(invoice.currency, total);
    bySupplier.set(key, supplier);
  }
  return {
    asOf: today.toISOString().slice(0, 10),
    totals: [...totals.values()],
    bySupplier: [...bySupplier.values()].sort((a, b) => b.open - a.open),
  };
}
