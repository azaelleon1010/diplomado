/**
 * Purchasing stores — Infrastructure implementations of domain ports.
 *
 * Each store composes a BaseRepository (tenant isolation inherited,
 * never duplicated) and exposes the narrow port interface.
 */
import { BaseRepository, mapMongoError, type TenantContext } from '@erp/database';
import type { ClientSession } from 'mongoose';
import type { TxSession } from '../../tenant/domain/ports';
import type {
  CreatePurchaseOrderData,
  IPurchaseOrderStore,
  ISupplierStore,
  OrderFilters,
  SupplierFilters,
  SupplierTermsData,
  UpdatePurchaseOrderData,
} from '../domain/ports';
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, Supplier, SupplierStatus } from '../domain/entities';
import {
  PurchaseOrderModel,
  SupplierModel,
  type PurchaseOrderDoc,
  type SupplierDoc,
} from './models';

const oid = (v: unknown): string => String(v);
const sysCtx = (tenantId: string): TenantContext => ({ tenantId, userId: 'system' });
const asSession = (session?: TxSession): ClientSession | undefined =>
  (session as ClientSession | undefined) ?? undefined;

function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function toSupplier(doc: SupplierDoc): Supplier {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    code: doc.code,
    name: doc.name,
    contactName: doc.contactName,
    email: doc.email,
    phone: doc.phone,
    address: doc.address,
    taxId: doc.taxId,
    // Documents created before commercial terms existed get safe defaults.
    paymentTermsDays: doc.paymentTermsDays ?? 0,
    currency: doc.currency ?? 'MXN',
    leadTimeDays: doc.leadTimeDays,
    contacts: (doc.contacts ?? []).map((c) => ({ name: c.name, email: c.email, phone: c.phone, role: c.role, isPrimary: c.isPrimary })),
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toLine(m: { productId: string; quantity: number; unitCost: number; quantityReceived: number }): PurchaseOrderLine {
  return { productId: m.productId, quantity: m.quantity, unitCost: m.unitCost, quantityReceived: m.quantityReceived };
}

function toOrder(doc: PurchaseOrderDoc): PurchaseOrder {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    folio: doc.folio,
    supplierId: doc.supplierId,
    status: doc.status,
    expectedDate: doc.expectedDate,
    notes: doc.notes,
    receivedAt: doc.receivedAt,
    approvedBy: doc.approvedBy,
    approvedAt: doc.approvedAt,
    requestId: doc.requestId,
    lines: (doc.lines ?? []).map(toLine),
    subtotal: doc.subtotal,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

class SupplierBaseRepo extends BaseRepository<SupplierDoc> {}
class PurchaseOrderBaseRepo extends BaseRepository<PurchaseOrderDoc> {}

const SUPPLIER_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'code'];
const ORDER_SORT_FIELDS = ['createdAt', 'updatedAt', 'folio', 'expectedDate'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoSupplierStore implements ISupplierStore {
  private readonly base = new SupplierBaseRepo(SupplierModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<Supplier | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toSupplier(doc) : null;
  }

  async findByCode(tenantId: string, code: string, session?: TxSession): Promise<Supplier | null> {
    try {
      const q = SupplierModel.findOne({ tenantId, code: code.trim().toUpperCase() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toSupplier(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: SupplierFilters, page: number, limit: number, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.search) {
      const rx = { $regex: escapeRegExp(filters.search.trim()), $options: 'i' };
      filter.$or = [{ name: rx }, { code: rx }];
    }
    if (filters.status) filter.status = filters.status;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy, sortOrder }, undefined, { allowedSortFields: SUPPLIER_SORT_FIELDS });
    return {
      data: result.data.map(toSupplier),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: { tenantId: string; code: string; name: string; contactName?: string; email?: string; phone?: string; address?: string; taxId?: string; createdBy: string } & SupplierTermsData, session?: TxSession): Promise<Supplier> {
    const created = await this.base.create(
      clean({
        code: data.code.trim().toUpperCase(),
        name: data.name,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        taxId: data.taxId,
        paymentTermsDays: data.paymentTermsDays ?? 0,
        currency: data.currency ?? 'MXN',
        leadTimeDays: data.leadTimeDays ?? undefined,
        contacts: data.contacts ?? [],
        status: 'ACTIVE',
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toSupplier(created);
  }

  async update(tenantId: string, id: string, patch: { name?: string; contactName?: string | null; email?: string | null; phone?: string | null; address?: string | null; taxId?: string | null; status?: SupplierStatus } & SupplierTermsData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Supplier | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const set: Record<string, unknown> = { updatedBy, updatedAt: new Date() };
    const unset: Record<string, unknown> = {};
    const put = (key: string, value: unknown) => {
      if (value === undefined) return;
      if (value === null) unset[key] = 1;
      else set[key] = value;
    };
    put('name', typeof patch.name === 'string' ? patch.name.trim() : undefined);
    put('contactName', patch.contactName === undefined ? undefined : (patch.contactName?.trim() || null));
    put('email', patch.email === undefined ? undefined : (patch.email?.trim() || null));
    put('phone', patch.phone === undefined ? undefined : (patch.phone?.trim() || null));
    put('address', patch.address === undefined ? undefined : (patch.address?.trim() || null));
    put('taxId', patch.taxId === undefined ? undefined : (patch.taxId?.trim() || null));
    put('status', patch.status);
    put('paymentTermsDays', patch.paymentTermsDays);
    put('currency', patch.currency);
    put('leadTimeDays', patch.leadTimeDays);
    put('contacts', patch.contacts);
    try {
      const q = SupplierModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}), $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = SupplierModel.findOne({ tenantId, _id: id });
        if (s) existsQ.session(s);
        const exists = await existsQ.exec();
        if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
        return null;
      }
      return toSupplier(updated);
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

export class MongoPurchaseOrderStore implements IPurchaseOrderStore {
  private readonly base = new PurchaseOrderBaseRepo(PurchaseOrderModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<PurchaseOrder | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toOrder(doc) : null;
  }

  async findByFolio(tenantId: string, folio: string, session?: TxSession): Promise<PurchaseOrder | null> {
    try {
      const q = PurchaseOrderModel.findOne({ tenantId, folio: folio.trim().toUpperCase() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toOrder(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: OrderFilters, page: number, limit: number, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.supplierId) filter.supplierId = filters.supplierId;
    if (filters.status) filter.status = filters.status;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy, sortOrder }, undefined, { allowedSortFields: ORDER_SORT_FIELDS });
    return {
      data: result.data.map(toOrder),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async countBySupplier(tenantId: string, supplierId: string, session?: TxSession): Promise<number> {
    try {
      const q = PurchaseOrderModel.countDocuments({ tenantId, supplierId });
      const s = asSession(session);
      if (s) q.session(s);
      return await q.exec();
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async create(data: CreatePurchaseOrderData, session?: TxSession): Promise<PurchaseOrder> {
    const subtotal = data.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
    const created = await this.base.create(
      clean({
        folio: data.folio.trim().toUpperCase(),
        supplierId: data.supplierId,
        status: 'DRAFT',
        expectedDate: data.expectedDate,
        notes: data.notes,
        lines: data.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, quantityReceived: 0 })),
        subtotal,
        requestId: data.requestId,
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toOrder(created);
  }

  async update(tenantId: string, id: string, patch: UpdatePurchaseOrderData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<PurchaseOrder | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const set: Record<string, unknown> = { updatedBy, updatedAt: new Date() };
    const unset: Record<string, unknown> = {};
    const put = (key: string, value: unknown) => {
      if (value === undefined) return;
      if (value === null) unset[key] = 1;
      else set[key] = value;
    };
    put('expectedDate', patch.expectedDate);
    put('notes', patch.notes === undefined ? undefined : (patch.notes?.trim() || null));
    if (patch.lines !== undefined) {
      const lines = patch.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, quantityReceived: 0 }));
      set.lines = lines;
      set.subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
    }
    try {
      const q = PurchaseOrderModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}), $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = PurchaseOrderModel.findOne({ tenantId, _id: id });
        if (s) existsQ.session(s);
        const exists = await existsQ.exec();
        if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
        return null;
      }
      return toOrder(updated);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async applyReceipt(tenantId: string, id: string, receivedDelta: Record<string, number>, status: PurchaseOrderStatus, expectedVersion: number, updatedBy: string, session: TxSession): Promise<PurchaseOrder | null> {
    const s = asSession(session);
    try {
      const currentQ = PurchaseOrderModel.findOne({ tenantId, _id: id });
      if (s) currentQ.session(s);
      const current = await currentQ.exec();
      if (!current) return null;
      const lines = current.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        quantityReceived: Math.round(((line.quantityReceived ?? 0) + (receivedDelta[line.productId] ?? 0)) * 1000) / 1000,
      }));
      const q = PurchaseOrderModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: { lines, status, receivedAt: new Date().toISOString(), updatedBy, updatedAt: new Date() }, $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
      return toOrder(updated);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async transition(tenantId: string, id: string, to: PurchaseOrderStatus, expectedVersion: number, updatedBy: string, extra?: { lines?: PurchaseOrderLine[] }, session?: TxSession): Promise<PurchaseOrder | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const now = new Date().toISOString();
    const set: Record<string, unknown> = { status: to, updatedBy, updatedAt: new Date() };
    if (to === 'APPROVED') {
      set.approvedBy = updatedBy;
      set.approvedAt = new Date();
    }
    if (to === 'RECEIVED' || to === 'PARTIALLY_RECEIVED') {
      set.receivedAt = now;
      if (extra?.lines !== undefined) {
        // Merge received quantities onto the order lines by productId.
        const received = new Map(extra.lines.map((l) => [l.productId, l.quantityReceived] as const));
        set.lines = current.lines.map((line) => ({
          ...line,
          quantityReceived: received.get(line.productId) ?? line.quantityReceived,
        }));
        const subtotal = current.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
        set.subtotal = subtotal;
      }
    }
    try {
      const q = PurchaseOrderModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = PurchaseOrderModel.findOne({ tenantId, _id: id });
        if (s) existsQ.session(s);
        const exists = await existsQ.exec();
        if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
        return null;
      }
      return toOrder(updated);
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}
