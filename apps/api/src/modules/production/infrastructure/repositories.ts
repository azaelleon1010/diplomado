/**
 * Production stores — Infrastructure implementations of domain ports.
 * The store composes a BaseRepository (tenant isolation inherited,
 * never duplicated) and exposes the narrow port interface.
 */
import { BaseRepository, mapMongoError, type TenantContext } from '@erp/database';
import type { ClientSession } from 'mongoose';
import type { TxSession } from '../../tenant/domain/ports';
import type {
  CreateProductionOrderData,
  IProductionOrderStore,
  ProductionOrderFilters,
  UpdateProductionOrderData,
} from '../domain/ports';
import type { ProductionOrder, ProductionOrderStatus } from '../domain/entities';
import { ProductionOrderModel, type ProductionOrderDoc } from './models';

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

function toOrder(doc: ProductionOrderDoc): ProductionOrder {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    code: doc.code,
    productId: doc.productId,
    quantity: doc.quantity,
    producedQuantity: doc.producedQuantity,
    status: doc.status,
    machine: doc.machine,
    responsible: doc.responsible,
    dueDate: doc.dueDate,
    notes: doc.notes,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt,
    materials: (doc.materials ?? []).map((m) => ({
      productId: m.productId,
      quantityRequired: m.quantityRequired,
      quantityConsumed: m.quantityConsumed,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

class OrderBaseRepo extends BaseRepository<ProductionOrderDoc> {}

const ORDER_SORT_FIELDS = ['createdAt', 'updatedAt', 'code', 'dueDate'];

export class MongoProductionOrderStore implements IProductionOrderStore {
  private readonly base = new OrderBaseRepo(ProductionOrderModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<ProductionOrder | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toOrder(doc) : null;
  }

  async findByCode(tenantId: string, code: string, session?: TxSession): Promise<ProductionOrder | null> {
    try {
      const q = ProductionOrderModel.findOne({ tenantId, code: code.trim().toUpperCase() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toOrder(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: ProductionOrderFilters, page: number, limit: number, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.productId) filter.productId = filters.productId;
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

  async create(data: CreateProductionOrderData, session?: TxSession): Promise<ProductionOrder> {
    const created = await this.base.create(
      clean({
        code: data.code.trim().toUpperCase(),
        productId: data.productId,
        quantity: data.quantity,
        producedQuantity: 0,
        status: 'DRAFT',
        machine: data.machine,
        responsible: data.responsible,
        dueDate: data.dueDate,
        notes: data.notes,
        materials: data.materials.map((m) => ({
          productId: m.productId,
          quantityRequired: m.quantityRequired,
          quantityConsumed: 0,
        })),
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toOrder(created);
  }

  async update(tenantId: string, id: string, patch: UpdateProductionOrderData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<ProductionOrder | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const set: Record<string, unknown> = { updatedBy, updatedAt: new Date() };
    const unset: Record<string, unknown> = {};
    const put = (key: string, value: unknown) => {
      if (value === undefined) return;
      if (value === null) unset[key] = 1;
      else set[key] = value;
    };
    put('quantity', patch.quantity);
    put('machine', patch.machine === undefined ? undefined : (patch.machine?.trim() || null));
    put('responsible', patch.responsible === undefined ? undefined : (patch.responsible?.trim() || null));
    put('dueDate', patch.dueDate);
    put('notes', patch.notes === undefined ? undefined : (patch.notes?.trim() || null));
    if (patch.materials !== undefined) {
      set.materials = patch.materials.map((m) => ({
        productId: m.productId,
        quantityRequired: m.quantityRequired,
        quantityConsumed: m.quantityConsumed ?? 0,
      }));
    }
    try {
      const q = ProductionOrderModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}), $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = ProductionOrderModel.findOne({ tenantId, _id: id });
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

  async transition(tenantId: string, id: string, to: ProductionOrderStatus, expectedVersion: number, updatedBy: string, extra?: { producedQuantity?: number; materials?: Array<{ productId: string; quantityRequired: number; quantityConsumed?: number }> }, session?: TxSession): Promise<ProductionOrder | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const now = new Date().toISOString();
    const set: Record<string, unknown> = { status: to, updatedBy, updatedAt: new Date() };
    if (to === 'IN_PROGRESS' && !current.startedAt) set.startedAt = now;
    if (to === 'COMPLETED') {
      set.completedAt = now;
      if (extra?.producedQuantity !== undefined) set.producedQuantity = extra.producedQuantity;
      if (extra?.materials !== undefined) {
        set.materials = extra.materials.map((m) => ({
          productId: m.productId,
          quantityRequired: m.quantityRequired,
          quantityConsumed: m.quantityConsumed ?? 0,
        }));
      }
    }
    try {
      const q = ProductionOrderModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = ProductionOrderModel.findOne({ tenantId, _id: id });
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
