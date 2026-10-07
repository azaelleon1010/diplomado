/**
 * Shared purchasing contract for the Web and Mobile clients.
 *
 * Mirrors apps/api/src/modules/purchasing. The API enforces every rule
 * (permissions, transitions, three-way match, idempotency); the action
 * helpers here only decide which buttons to show.
 */
import type { InventoryRequestClient, InventoryRequestOptions } from './inventory';
import { hasPermission } from './permissions';

export type PurchasingRequestClient = InventoryRequestClient;
type Options = InventoryRequestOptions;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface SupplierContact {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface Supplier {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays: number;
  currency: string;
  leadTimeDays?: number;
  contacts: SupplierContact[];
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderLine {
  productId: string;
  quantity: number;
  unitCost: number;
  quantityReceived: number;
  quantityInvoiced: number;
}

export interface PurchaseOrder {
  _id: string;
  tenantId: string;
  folio: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  expectedDate?: string;
  notes?: string;
  receivedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  requestId?: string;
  lines: PurchaseOrderLine[];
  subtotal: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface GoodsReceipt {
  _id: string;
  folio: string;
  purchaseOrderId: string;
  purchaseOrderFolio: string;
  supplierId: string;
  warehouseId: string;
  status: 'POSTED';
  lines: Array<{ productId: string; quantity: number; unitCost: number; stocked: boolean }>;
  total: number;
  postingId?: string;
  notes?: string;
  receivedAt: string;
  createdBy: string;
}

export type PurchaseRequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ORDERED' | 'CANCELLED';

export interface PurchaseRequest {
  _id: string;
  folio: string;
  requestedBy: string;
  department?: string;
  neededBy?: string;
  justification?: string;
  lines: Array<{ productId: string; quantity: number; notes?: string }>;
  status: PurchaseRequestStatus;
  submittedAt?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
  purchaseOrderId?: string;
  createdAt: string;
  version: number;
}

export interface SupplierQuote {
  _id: string;
  folio: string;
  requestId: string;
  supplierId: string;
  currency: string;
  validUntil?: string;
  notes?: string;
  lines: Array<{ productId: string; unitCost: number; quantity?: number; leadTimeDays?: number }>;
  total: number;
  status: 'RECEIVED' | 'AWARDED' | 'DISCARDED';
  purchaseOrderId?: string;
  version: number;
}

export interface QuoteComparison {
  requestId: string;
  quotes: SupplierQuote[];
  lines: Array<{
    productId: string;
    requestedQuantity: number;
    offers: Array<{ quoteId: string; supplierId: string; unitCost: number; quantity?: number; leadTimeDays?: number }>;
    bestQuoteId?: string;
  }>;
  bestCompleteQuoteId?: string;
}

export type SupplierInvoiceStatus = 'ON_HOLD' | 'POSTED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface SupplierInvoice {
  _id: string;
  folio: string;
  supplierInvoiceNumber: string;
  supplierId: string;
  purchaseOrderId: string;
  purchaseOrderFolio: string;
  currency: string;
  invoiceDate: string;
  dueDate: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number; orderUnitCost: number }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: SupplierInvoiceStatus;
  matchIssues: Array<{ productId: string; type: 'PRICE_VARIANCE'; orderUnitCost: number; invoiceUnitCost: number; variancePct: number }>;
  notes?: string;
  version: number;
}

export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export interface PayablesSummary {
  asOf: string;
  totals: Array<{ currency: string; open: number; overdue: number; buckets: Record<AgingBucket, number>; invoices: number }>;
  bySupplier: Array<{ supplierId: string; currency: string; open: number; overdue: number; buckets: Record<AgingBucket, number>; invoices: number; nextDueDate?: string }>;
}

// ---------------------------------------------------------------------------
// Labels and UI rules (presentation only)
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const ORDER_STATUS: Readonly<Record<PurchaseOrderStatus, { label: string; tone: Tone }>> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  SENT: { label: 'Enviada', tone: 'info' },
  APPROVED: { label: 'Aprobada', tone: 'info' },
  PARTIALLY_RECEIVED: { label: 'Recepción parcial', tone: 'warning' },
  RECEIVED: { label: 'Recibida', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

export const REQUEST_STATUS: Readonly<Record<PurchaseRequestStatus, { label: string; tone: Tone }>> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  SUBMITTED: { label: 'Por aprobar', tone: 'warning' },
  APPROVED: { label: 'Aprobada', tone: 'info' },
  REJECTED: { label: 'Rechazada', tone: 'danger' },
  ORDERED: { label: 'Convertida en OC', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

export const INVOICE_STATUS: Readonly<Record<SupplierInvoiceStatus, { label: string; tone: Tone }>> = {
  ON_HOLD: { label: 'Retenida (diferencia)', tone: 'warning' },
  POSTED: { label: 'Por pagar', tone: 'info' },
  PARTIALLY_PAID: { label: 'Pago parcial', tone: 'info' },
  PAID: { label: 'Pagada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

export const AGING_LABELS: Readonly<Record<AgingBucket, string>> = {
  current: 'Por vencer',
  d1_30: '1–30 días',
  d31_60: '31–60 días',
  d61_90: '61–90 días',
  d90_plus: '+90 días',
};

export type OrderAction = 'SEND' | 'APPROVE' | 'RECEIVE' | 'CANCEL' | 'EDIT';

/** Actions the current user may attempt on an order (same rules as the API). */
export function orderActions(order: Pick<PurchaseOrder, 'status'>, permissions: readonly string[]): OrderAction[] {
  const can = (p: string) => hasPermission(permissions, p);
  const actions: OrderAction[] = [];
  if (order.status === 'DRAFT' && can('purchasing.update')) actions.push('EDIT', 'SEND');
  if (order.status === 'SENT' && can('purchasing.approve')) actions.push('APPROVE');
  if ((order.status === 'APPROVED' || order.status === 'PARTIALLY_RECEIVED') && can('purchasing.receive')) actions.push('RECEIVE');
  if (['DRAFT', 'SENT', 'APPROVED', 'PARTIALLY_RECEIVED'].includes(order.status) && can('purchasing.cancel')) actions.push('CANCEL');
  return actions;
}

export type RequestAction = 'EDIT' | 'SUBMIT' | 'DECIDE' | 'QUOTE' | 'CONVERT' | 'CANCEL';

export function requestActions(request: Pick<PurchaseRequest, 'status'>, permissions: readonly string[]): RequestAction[] {
  const can = (p: string) => hasPermission(permissions, p);
  const actions: RequestAction[] = [];
  if (request.status === 'DRAFT' && can('purchasing.create')) actions.push('EDIT', 'SUBMIT');
  if (request.status === 'SUBMITTED' && can('purchasing.approve')) actions.push('DECIDE');
  if ((request.status === 'SUBMITTED' || request.status === 'APPROVED') && can('purchasing.create')) actions.push('QUOTE');
  if (request.status === 'APPROVED' && can('purchasing.create')) actions.push('CONVERT');
  if (['DRAFT', 'SUBMITTED', 'APPROVED'].includes(request.status) && can('purchasing.cancel')) actions.push('CANCEL');
  return actions;
}

/** Quantity still to receive per line. */
export function pendingToReceive(line: PurchaseOrderLine): number {
  return Math.max(0, Math.round((line.quantity - line.quantityReceived) * 1000) / 1000);
}

/** Quantity received and not yet billed per line (three-way match). */
export function pendingToInvoice(line: PurchaseOrderLine): number {
  return Math.max(0, Math.round((line.quantityReceived - line.quantityInvoiced) * 1000) / 1000);
}

export function formatMoney(value: number, currency = 'MXN'): string {
  try {
    return value.toLocaleString('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Spanish messages for purchasing business errors (API messages are technical English). */
export function describePurchasingError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message, fields } = error as { code?: unknown; message?: unknown; fields?: Record<string, unknown> };
  const text = typeof message === 'string' ? message : '';
  if (code === 'VALIDATION_ERROR' && typeof fields?.pending === 'number') {
    return `La cantidad excede lo pendiente por recibir (pendiente: ${fields.pending}).`;
  }
  if (code === 'VALIDATION_ERROR' && typeof fields?.billable === 'number') {
    return `Solo se puede facturar lo recibido y no facturado (disponible: ${fields.billable}).`;
  }
  if (code === 'VALIDATION_ERROR' && fields?.use === 'receipts') return 'Las recepciones se registran con el formulario de recepción.';
  if (code === 'IDEMPOTENCY_CONFLICT') return 'Esta operación ya se había enviado con otros datos. Revisa antes de reintentar.';
  if (code === 'VERSION_CONFLICT') return 'Otro usuario modificó este documento. Recarga para ver la versión más reciente.';
  if (code === 'FORBIDDEN') return 'Tu rol no permite realizar esta acción.';
  if (code === 'CONFLICT' && text.includes('supplier invoice number')) return 'Ese número de factura ya está registrado para el proveedor.';
  if (code === 'CONFLICT' && text.includes('already quoted')) return 'Este proveedor ya cotizó la solicitud.';
  if (text.includes('rejection requires a reason')) return 'Indica el motivo del rechazo.';
  return null;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const BASE = '/api/v1/purchasing';

function query(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '' && value !== false)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

const enc = encodeURIComponent;

export function createPurchasingApi(client: PurchasingRequestClient) {
  async function page<T>(path: string, token: string): Promise<Page<T>> {
    const result = await client.page<T[]>(path, { token });
    const items = Array.isArray(result.data) ? result.data : [];
    const num = (k: string, d: number) => (typeof result.meta?.[k] === 'number' ? (result.meta[k] as number) : d);
    return { items, total: num('total', items.length), page: num('page', 1), limit: num('limit', items.length), totalPages: num('totalPages', 1) };
  }
  const get = <T>(path: string, token: string) => client.request<T>(path, { token });
  const send = <T>(path: string, token: string, body?: unknown, method: Options['method'] = 'POST') => client.request<T>(path, { method, token, body });

  return {
    // Suppliers
    listSuppliers: (token: string, params: { search?: string; status?: 'ACTIVE' | 'INACTIVE' } = {}) =>
      page<Supplier>(`${BASE}/suppliers${query({ ...params, page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' })}`, token),
    createSupplier: (token: string, body: Partial<Supplier> & { code: string; name: string }) => send<Supplier>(`${BASE}/suppliers`, token, body),
    updateSupplier: (token: string, id: string, body: Record<string, unknown> & { expectedVersion: number }) => send<Supplier>(`${BASE}/suppliers/${enc(id)}`, token, body, 'PATCH'),
    deactivateSupplier: (token: string, id: string) => send<Supplier>(`${BASE}/suppliers/${enc(id)}`, token, undefined, 'DELETE'),

    // Purchase orders
    listOrders: (token: string, params: { status?: PurchaseOrderStatus; supplierId?: string; page?: number; limit?: number } = {}) =>
      page<PurchaseOrder>(`${BASE}/orders${query({ status: params.status, supplierId: params.supplierId, page: params.page ?? 1, limit: params.limit ?? 50 })}`, token),
    getOrder: (token: string, id: string) => get<PurchaseOrder>(`${BASE}/orders/${enc(id)}`, token),
    createOrder: (token: string, body: { folio: string; supplierId: string; expectedDate?: string; notes?: string; lines: Array<{ productId: string; quantity: number; unitCost: number }> }) =>
      send<PurchaseOrder>(`${BASE}/orders`, token, body),
    transitionOrder: (token: string, id: string, to: 'SENT' | 'APPROVED' | 'CANCELLED', expectedVersion: number) =>
      send<PurchaseOrder>(`${BASE}/orders/${enc(id)}/transition`, token, { to, expectedVersion }),
    receiveOrder: (token: string, id: string, body: { warehouseId: string; lines: Array<{ productId: string; quantity: number }>; notes?: string; idempotencyKey: string }) =>
      send<{ receipt: GoodsReceipt; order: PurchaseOrder; replayed: boolean }>(`${BASE}/orders/${enc(id)}/receipts`, token, body),
    listReceipts: (token: string, params: { purchaseOrderId?: string; supplierId?: string } = {}) =>
      page<GoodsReceipt>(`${BASE}/receipts${query({ ...params, page: 1, limit: 100 })}`, token),

    // Purchase requests
    listRequests: (token: string, params: { status?: PurchaseRequestStatus; mine?: boolean } = {}) =>
      page<PurchaseRequest>(`${BASE}/requests${query({ status: params.status, mine: params.mine, page: 1, limit: 100 })}`, token),
    getRequest: (token: string, id: string) => get<PurchaseRequest>(`${BASE}/requests/${enc(id)}`, token),
    createRequest: (token: string, body: { department?: string; neededBy?: string; justification?: string; lines: Array<{ productId: string; quantity: number; notes?: string }> }) =>
      send<PurchaseRequest>(`${BASE}/requests`, token, body),
    submitRequest: (token: string, id: string, expectedVersion: number) => send<PurchaseRequest>(`${BASE}/requests/${enc(id)}/submit`, token, { expectedVersion }),
    decideRequest: (token: string, id: string, decision: 'APPROVED' | 'REJECTED', expectedVersion: number, reason?: string) =>
      send<PurchaseRequest>(`${BASE}/requests/${enc(id)}/decision`, token, { decision, expectedVersion, ...(reason ? { reason } : {}) }),
    cancelRequest: (token: string, id: string) => send<PurchaseRequest>(`${BASE}/requests/${enc(id)}/cancel`, token),
    convertRequest: (token: string, id: string, body: { supplierId: string; folio?: string; expectedDate?: string; lines: Array<{ productId: string; unitCost: number; quantity?: number }>; expectedVersion: number }) =>
      send<{ request: PurchaseRequest; order: PurchaseOrder }>(`${BASE}/requests/${enc(id)}/convert`, token, body),

    // Quotes
    compareQuotes: (token: string, requestId: string) => get<QuoteComparison>(`${BASE}/requests/${enc(requestId)}/quotes`, token),
    createQuote: (token: string, requestId: string, body: { supplierId: string; validUntil?: string; notes?: string; lines: Array<{ productId: string; unitCost: number; quantity?: number; leadTimeDays?: number }> }) =>
      send<SupplierQuote>(`${BASE}/requests/${enc(requestId)}/quotes`, token, body),
    awardQuote: (token: string, quoteId: string, expectedVersion: number) =>
      send<{ quote: SupplierQuote; order: PurchaseOrder; request: PurchaseRequest }>(`${BASE}/quotes/${enc(quoteId)}/award`, token, { expectedVersion }),

    // Supplier invoices / payables
    listInvoices: (token: string, params: { supplierId?: string; purchaseOrderId?: string; status?: SupplierInvoiceStatus; open?: boolean } = {}) =>
      page<SupplierInvoice>(`${BASE}/invoices${query({ ...params, page: 1, limit: 100 })}`, token),
    registerInvoice: (token: string, body: { purchaseOrderId: string; supplierInvoiceNumber: string; invoiceDate: string; taxRate?: number; notes?: string; lines: Array<{ productId: string; quantity: number; unitCost: number }>; idempotencyKey: string }) =>
      send<{ invoice: SupplierInvoice; replayed: boolean }>(`${BASE}/invoices`, token, body),
    releaseInvoice: (token: string, id: string, expectedVersion: number) => send<SupplierInvoice>(`${BASE}/invoices/${enc(id)}/release`, token, { expectedVersion }),
    cancelInvoice: (token: string, id: string, reason: string, expectedVersion: number) => send<SupplierInvoice>(`${BASE}/invoices/${enc(id)}/cancel`, token, { reason, expectedVersion }),
    payables: (token: string, supplierId?: string) => get<PayablesSummary>(`${BASE}/payables${query({ supplierId })}`, token),
  };
}

export type PurchasingApi = ReturnType<typeof createPurchasingApi>;
