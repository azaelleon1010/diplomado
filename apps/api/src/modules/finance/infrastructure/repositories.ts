/**
 * Finance stores — Infrastructure implementations of domain ports.
 *
 * Each store composes a BaseRepository (tenant isolation inherited,
 * never duplicated) and exposes the narrow port interface.
 */
import { BaseRepository, mapMongoError, type TenantContext } from '@erp/database';
import type { ClientSession } from 'mongoose';
import type { TxSession } from '../../tenant/domain/ports';
import type {
  IAccountStore,
  IFinanceCategoryStore,
  IMovementStore,
  MovementFilters,
} from '../domain/ports';
import type {
  Account,
  AccountStatus,
  AccountType,
  FinanceCategory,
  FinanceCategoryKind,
  FinanceMovement,
  FinanceMovementKind,
  PaymentMethod,
} from '../domain/entities';
import {
  AccountModel,
  FinanceCategoryModel,
  FinanceMovementModel,
  type AccountDoc,
  type FinanceCategoryDoc,
  type FinanceMovementDoc,
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

function toAccount(doc: AccountDoc): Account {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    code: doc.code,
    name: doc.name,
    type: doc.type,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toCategory(doc: FinanceCategoryDoc): FinanceCategory {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    name: doc.name,
    kind: doc.kind,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toMovement(doc: FinanceMovementDoc): FinanceMovement {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    accountId: doc.accountId,
    categoryId: doc.categoryId,
    kind: doc.kind,
    amount: doc.amount,
    method: doc.method,
    concept: doc.concept,
    reference: doc.reference,
    date: doc.date,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

class AccountBaseRepo extends BaseRepository<AccountDoc> {}
class CategoryBaseRepo extends BaseRepository<FinanceCategoryDoc> {}
class MovementBaseRepo extends BaseRepository<FinanceMovementDoc> {}

const ACCOUNT_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'code'];
const CATEGORY_SORT_FIELDS = ['createdAt', 'updatedAt', 'name'];
const MOVEMENT_SORT_FIELDS = ['createdAt', 'date', 'amount'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoAccountStore implements IAccountStore {
  private readonly base = new AccountBaseRepo(AccountModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<Account | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toAccount(doc) : null;
  }

  async findByCode(tenantId: string, code: string, session?: TxSession): Promise<Account | null> {
    try {
      const q = AccountModel.findOne({ tenantId, code: code.trim() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toAccount(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: { search?: string; type?: AccountType; status?: AccountStatus }, page: number, limit: number) {
    const filter: Record<string, unknown> = {};
    if (filters.search) {
      const rx = { $regex: escapeRegExp(filters.search.trim()), $options: 'i' };
      filter.$or = [{ name: rx }, { code: rx }];
    }
    if (filters.type) filter.type = filters.type;
    if (filters.status) filter.status = filters.status;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy: 'code', sortOrder: 'asc' }, undefined, { allowedSortFields: ACCOUNT_SORT_FIELDS });
    return {
      data: result.data.map(toAccount),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: { tenantId: string; code: string; name: string; type: AccountType; description?: string; createdBy: string }, session?: TxSession): Promise<Account> {
    const created = await this.base.create(
      clean({ code: data.code.trim(), name: data.name, type: data.type, description: data.description, status: 'ACTIVE' }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toAccount(created);
  }

  async update(tenantId: string, id: string, patch: { name?: string; description?: string; status?: AccountStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Account | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const updated = await this.base.updateById(id, patch, { tenantId, userId: updatedBy }, expectedVersion, asSession(session));
    return toAccount(updated);
  }

  async countMovements(tenantId: string, accountId: string, session?: TxSession): Promise<number> {
    try {
      const q = FinanceMovementModel.countDocuments({ tenantId, accountId });
      const s = asSession(session);
      if (s) q.session(s);
      return await q.exec();
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

export class MongoFinanceCategoryStore implements IFinanceCategoryStore {
  private readonly base = new CategoryBaseRepo(FinanceCategoryModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<FinanceCategory | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toCategory(doc) : null;
  }

  async findByName(tenantId: string, name: string, session?: TxSession): Promise<FinanceCategory | null> {
    try {
      const q = FinanceCategoryModel.findOne({ tenantId, name });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toCategory(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: { kind?: FinanceCategoryKind; status?: AccountStatus }, page: number, limit: number) {
    const filter: Record<string, unknown> = {};
    if (filters.kind) filter.kind = filters.kind;
    if (filters.status) filter.status = filters.status;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy: 'name', sortOrder: 'asc' }, undefined, { allowedSortFields: CATEGORY_SORT_FIELDS });
    return {
      data: result.data.map(toCategory),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: { tenantId: string; name: string; kind: FinanceCategoryKind; description?: string; createdBy: string }, session?: TxSession): Promise<FinanceCategory> {
    const created = await this.base.create(
      clean({ name: data.name, kind: data.kind, description: data.description, status: 'ACTIVE' }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toCategory(created);
  }

  async update(tenantId: string, id: string, patch: { name?: string; description?: string; status?: AccountStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<FinanceCategory | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const updated = await this.base.updateById(id, patch, { tenantId, userId: updatedBy }, expectedVersion, asSession(session));
    return toCategory(updated);
  }

  async countMovements(tenantId: string, categoryId: string, session?: TxSession): Promise<number> {
    try {
      const q = FinanceMovementModel.countDocuments({ tenantId, categoryId });
      const s = asSession(session);
      if (s) q.session(s);
      return await q.exec();
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

export class MongoMovementStore implements IMovementStore {
  private readonly base = new MovementBaseRepo(FinanceMovementModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<FinanceMovement | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toMovement(doc) : null;
  }

  async list(tenantId: string, filters: MovementFilters, page: number, limit: number, sortBy = 'date', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.accountId) filter.accountId = filters.accountId;
    if (filters.categoryId) filter.categoryId = filters.categoryId;
    if (filters.kind) filter.kind = filters.kind;
    if (filters.status) filter.status = filters.status;
    if (filters.dateFrom ?? filters.dateTo) {
      const range: Record<string, string> = {};
      if (filters.dateFrom) range.$gte = filters.dateFrom;
      if (filters.dateTo) range.$lte = filters.dateTo;
      filter.date = range;
    }
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy, sortOrder }, undefined, { allowedSortFields: MOVEMENT_SORT_FIELDS });
    return {
      data: result.data.map(toMovement),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async totals(tenantId: string, filters: { accountId?: string; dateFrom?: string; dateTo?: string }, session?: TxSession): Promise<{ income: number; expenses: number; balance: number }> {
    try {
      const match: Record<string, unknown> = { tenantId, status: 'POSTED' };
      if (filters.accountId) match.accountId = filters.accountId;
      if (filters.dateFrom ?? filters.dateTo) {
        const range: Record<string, string> = {};
        if (filters.dateFrom) range.$gte = filters.dateFrom;
        if (filters.dateTo) range.$lte = filters.dateTo;
        match.date = range;
      }
      const pipeline: Array<{ $match: Record<string, unknown> } | { $group: { _id: string; total: Record<string, unknown> } }> = [
        { $match: match },
        { $group: { _id: '$kind', total: { $sum: '$amount' } } },
      ];
      const agg = FinanceMovementModel.aggregate(pipeline);
      const s = asSession(session);
      if (s) agg.session(s);
      const rows = (await agg.exec()) as Array<{ _id: string; total: number }>;
      let income = 0;
      let expenses = 0;
      for (const row of rows) {
        if (row._id === 'INCOME') income = row.total;
        else if (row._id === 'EXPENSE') expenses = row.total;
      }
      return { income, expenses, balance: income - expenses };
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async create(data: { tenantId: string; accountId: string; categoryId?: string; kind: FinanceMovementKind; amount: number; method: PaymentMethod; concept: string; reference?: string; date: string; createdBy: string }, session?: TxSession): Promise<FinanceMovement> {
    const created = await this.base.create(
      clean({
        accountId: data.accountId,
        categoryId: data.categoryId,
        kind: data.kind,
        amount: data.amount,
        method: data.method,
        concept: data.concept,
        reference: data.reference,
        date: data.date,
        status: 'POSTED',
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toMovement(created);
  }

  async void(tenantId: string, id: string, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<FinanceMovement | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const updated = await this.base.updateById(id, { status: 'VOIDED' }, { tenantId, userId: updatedBy }, expectedVersion, asSession(session));
    return toMovement(updated);
  }
}
