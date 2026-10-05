/**
 * Maintenance stores — Infrastructure implementations of domain ports.
 *
 * Each store composes a BaseRepository (tenant isolation inherited,
 * never duplicated) and exposes the narrow port interface.
 */
import { BaseRepository, mapMongoError, type TenantContext } from '@erp/database';
import type { ClientSession } from 'mongoose';
import type { TxSession } from '../../tenant/domain/ports';
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
import type { Asset, AssetStatus, MaintenanceOrder, MaintenanceOrderStatus } from '../domain/entities';
import {
  AssetModel,
  MaintenanceOrderModel,
  type AssetDoc,
  type MaintenanceOrderDoc,
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

function toAsset(doc: AssetDoc): Asset {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    code: doc.code,
    name: doc.name,
    type: doc.type,
    location: doc.location,
    responsible: doc.responsible,
    status: doc.status,
    purchaseDate: doc.purchaseDate,
    warrantyUntil: doc.warrantyUntil,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toOrder(doc: MaintenanceOrderDoc): MaintenanceOrder {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    assetId: doc.assetId,
    type: doc.type,
    priority: doc.priority,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    scheduledFor: doc.scheduledFor,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt,
    cost: doc.cost,
    assignedTo: doc.assignedTo,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

class AssetBaseRepo extends BaseRepository<AssetDoc> {}
class OrderBaseRepo extends BaseRepository<MaintenanceOrderDoc> {}

const ASSET_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'code'];
const ORDER_SORT_FIELDS = ['createdAt', 'updatedAt', 'priority', 'scheduledFor'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoAssetStore implements IAssetStore {
  private readonly base = new AssetBaseRepo(AssetModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<Asset | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toAsset(doc) : null;
  }

  async findByCode(tenantId: string, code: string, session?: TxSession): Promise<Asset | null> {
    try {
      const q = AssetModel.findOne({ tenantId, code: code.trim().toUpperCase() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toAsset(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: AssetFilters, page: number, limit: number, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.search) {
      const rx = { $regex: escapeRegExp(filters.search.trim()), $options: 'i' };
      filter.$or = [{ name: rx }, { code: rx }];
    }
    if (filters.status) filter.status = filters.status;
    if (filters.type) filter.type = filters.type;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy, sortOrder }, undefined, { allowedSortFields: ASSET_SORT_FIELDS });
    return {
      data: result.data.map(toAsset),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: CreateAssetData, session?: TxSession): Promise<Asset> {
    const created = await this.base.create(
      clean({
        code: data.code.trim().toUpperCase(),
        name: data.name,
        type: data.type,
        location: data.location,
        responsible: data.responsible,
        purchaseDate: data.purchaseDate,
        warrantyUntil: data.warrantyUntil,
        notes: data.notes,
        status: 'ACTIVE',
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toAsset(created);
  }

  async update(tenantId: string, id: string, patch: UpdateAssetData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Asset | null> {
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
    put('type', typeof patch.type === 'string' ? patch.type.trim() : undefined);
    put('location', patch.location === undefined ? undefined : (patch.location?.trim() || null));
    put('responsible', patch.responsible === undefined ? undefined : (patch.responsible?.trim() || null));
    put('purchaseDate', patch.purchaseDate);
    put('warrantyUntil', patch.warrantyUntil);
    put('notes', patch.notes === undefined ? undefined : (patch.notes?.trim() || null));
    put('status', patch.status);
    try {
      const q = AssetModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}), $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = AssetModel.findOne({ tenantId, _id: id });
        if (s) existsQ.session(s);
        const exists = await existsQ.exec();
        if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
        return null;
      }
      return toAsset(updated);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async setStatus(tenantId: string, id: string, status: AssetStatus, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Asset | null> {
    return this.update(tenantId, id, { status }, expectedVersion, updatedBy, session);
  }
}

export class MongoMaintenanceOrderStore implements IMaintenanceOrderStore {
  private readonly base = new OrderBaseRepo(MaintenanceOrderModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<MaintenanceOrder | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toOrder(doc) : null;
  }

  async list(tenantId: string, filters: OrderFilters, page: number, limit: number, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.assetId) filter.assetId = filters.assetId;
    if (filters.status) filter.status = filters.status;
    if (filters.priority) filter.priority = filters.priority;
    if (filters.type) filter.type = filters.type;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy, sortOrder }, undefined, { allowedSortFields: ORDER_SORT_FIELDS });
    return {
      data: result.data.map(toOrder),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async countOpenByAsset(tenantId: string, assetId: string, session?: TxSession): Promise<number> {
    try {
      const q = MaintenanceOrderModel.countDocuments({ tenantId, assetId, status: { $in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] } });
      const s = asSession(session);
      if (s) q.session(s);
      return await q.exec();
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async create(data: CreateOrderData, session?: TxSession): Promise<MaintenanceOrder> {
    const created = await this.base.create(
      clean({
        assetId: data.assetId,
        type: data.type,
        priority: data.priority,
        title: data.title,
        description: data.description,
        status: 'OPEN',
        scheduledFor: data.scheduledFor,
        cost: data.cost,
        assignedTo: data.assignedTo,
        notes: data.notes,
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toOrder(created);
  }

  async update(tenantId: string, id: string, patch: UpdateOrderData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<MaintenanceOrder | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const set: Record<string, unknown> = { updatedBy, updatedAt: new Date() };
    const unset: Record<string, unknown> = {};
    const put = (key: string, value: unknown) => {
      if (value === undefined) return;
      if (value === null) unset[key] = 1;
      else set[key] = value;
    };
    put('title', typeof patch.title === 'string' ? patch.title.trim() : undefined);
    put('description', patch.description === undefined ? undefined : (patch.description?.trim() || null));
    put('priority', patch.priority);
    put('scheduledFor', patch.scheduledFor);
    put('cost', patch.cost);
    put('assignedTo', patch.assignedTo === undefined ? undefined : (patch.assignedTo?.trim() || null));
    put('notes', patch.notes === undefined ? undefined : (patch.notes?.trim() || null));
    try {
      const q = MaintenanceOrderModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}), $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = MaintenanceOrderModel.findOne({ tenantId, _id: id });
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

  async transition(tenantId: string, id: string, to: MaintenanceOrderStatus, expectedVersion: number, updatedBy: string, extra?: { completedCost?: number }, session?: TxSession): Promise<MaintenanceOrder | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const now = new Date().toISOString();
    const set: Record<string, unknown> = { status: to, updatedBy, updatedAt: new Date() };
    if (to === 'IN_PROGRESS' && !current.startedAt) set.startedAt = now;
    if (to === 'COMPLETED') {
      set.completedAt = now;
      if (extra?.completedCost !== undefined) set.cost = extra.completedCost;
    }
    try {
      const q = MaintenanceOrderModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = MaintenanceOrderModel.findOne({ tenantId, _id: id });
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
