/**
 * HR stores — Infrastructure implementations of domain ports.
 *
 * Each store composes a BaseRepository (tenant isolation inherited,
 * never duplicated) and exposes the narrow port interface.
 */
import { BaseRepository, mapMongoError, type TenantContext } from '@erp/database';
import type { ClientSession } from 'mongoose';
import type { TxSession } from '../../tenant/domain/ports';
import type {
  IDepartmentStore,
  IEmployeeStore,
  ITimeOffStore,
  TimeOffFilters,
} from '../domain/ports';
import type {
  Department,
  DepartmentStatus,
  Employee,
  EmployeeStatus,
  TimeOff,
  TimeOffStatus,
} from '../domain/entities';
import {
  DepartmentModel,
  EmployeeModel,
  TimeOffModel,
  type DepartmentDoc,
  type EmployeeDoc,
  type TimeOffDoc,
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

function toDepartment(doc: DepartmentDoc): Department {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    name: doc.name,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toEmployee(doc: EmployeeDoc): Employee {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    code: doc.code,
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    phone: doc.phone,
    departmentId: doc.departmentId,
    position: doc.position,
    location: doc.location,
    hireDate: doc.hireDate,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toTimeOff(doc: TimeOffDoc): TimeOff {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    employeeId: doc.employeeId,
    type: doc.type,
    startDate: doc.startDate,
    endDate: doc.endDate,
    status: doc.status,
    reason: doc.reason,
    decidedBy: doc.decidedBy,
    decidedAt: doc.decidedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

class DepartmentBaseRepo extends BaseRepository<DepartmentDoc> {}
class EmployeeBaseRepo extends BaseRepository<EmployeeDoc> {}
class TimeOffBaseRepo extends BaseRepository<TimeOffDoc> {}

const DEPARTMENT_SORT_FIELDS = ['createdAt', 'updatedAt', 'name'];
const EMPLOYEE_SORT_FIELDS = ['createdAt', 'updatedAt', 'lastName', 'code'];
const TIMEOFF_SORT_FIELDS = ['createdAt', 'updatedAt', 'startDate'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoDepartmentStore implements IDepartmentStore {
  private readonly base = new DepartmentBaseRepo(DepartmentModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<Department | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toDepartment(doc) : null;
  }

  async findByName(tenantId: string, name: string, session?: TxSession): Promise<Department | null> {
    try {
      const q = DepartmentModel.findOne({ tenantId, name });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toDepartment(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, page: number, limit: number) {
    const result = await this.base.findMany({}, sysCtx(tenantId), { page, limit, sortBy: 'name', sortOrder: 'asc' }, undefined, { allowedSortFields: DEPARTMENT_SORT_FIELDS });
    return {
      data: result.data.map(toDepartment),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: { tenantId: string; name: string; description?: string; createdBy: string }, session?: TxSession): Promise<Department> {
    const created = await this.base.create(
      clean({ name: data.name, description: data.description, status: 'ACTIVE' }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toDepartment(created);
  }

  async update(tenantId: string, id: string, patch: { name?: string; description?: string; status?: DepartmentStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Department | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const updated = await this.base.updateById(id, patch, { tenantId, userId: updatedBy }, expectedVersion, asSession(session));
    return toDepartment(updated);
  }

  async countActiveEmployees(tenantId: string, departmentId: string, session?: TxSession): Promise<number> {
    try {
      const q = EmployeeModel.countDocuments({ tenantId, departmentId, status: 'ACTIVE' });
      const s = asSession(session);
      if (s) q.session(s);
      return await q.exec();
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

export class MongoEmployeeStore implements IEmployeeStore {
  private readonly base = new EmployeeBaseRepo(EmployeeModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<Employee | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toEmployee(doc) : null;
  }

  async findByCode(tenantId: string, code: string, session?: TxSession): Promise<Employee | null> {
    try {
      const q = EmployeeModel.findOne({ tenantId, code: code.trim().toUpperCase() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toEmployee(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: { search?: string; departmentId?: string; status?: EmployeeStatus }, page: number, limit: number, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.search) {
      const rx = { $regex: escapeRegExp(filters.search.trim()), $options: 'i' };
      filter.$or = [{ firstName: rx }, { lastName: rx }, { code: rx }, { email: rx }];
    }
    if (filters.departmentId) filter.departmentId = filters.departmentId;
    if (filters.status) filter.status = filters.status;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy, sortOrder }, undefined, { allowedSortFields: EMPLOYEE_SORT_FIELDS });
    return {
      data: result.data.map(toEmployee),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: { tenantId: string; code: string; firstName: string; lastName: string; email?: string; phone?: string; departmentId?: string; position?: string; location?: string; hireDate?: string; createdBy: string }, session?: TxSession): Promise<Employee> {
    const created = await this.base.create(
      clean({
        code: data.code.trim().toUpperCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        departmentId: data.departmentId,
        position: data.position,
        location: data.location,
        hireDate: data.hireDate,
        status: 'ACTIVE',
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toEmployee(created);
  }

  async update(tenantId: string, id: string, patch: { firstName?: string; lastName?: string; email?: string | null; phone?: string | null; departmentId?: string | null; position?: string | null; location?: string | null; hireDate?: string | null; status?: EmployeeStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Employee | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const set: Record<string, unknown> = { updatedBy, updatedAt: new Date() };
    const unset: Record<string, unknown> = {};
    const put = (key: string, value: unknown) => {
      if (value === undefined) return;
      if (value === null) unset[key] = 1;
      else set[key] = value;
    };
    put('firstName', typeof patch.firstName === 'string' ? patch.firstName.trim() : undefined);
    put('lastName', typeof patch.lastName === 'string' ? patch.lastName.trim() : undefined);
    put('email', patch.email === undefined ? undefined : (patch.email?.trim() || null));
    put('phone', patch.phone === undefined ? undefined : (patch.phone?.trim() || null));
    put('departmentId', patch.departmentId);
    put('position', patch.position === undefined ? undefined : (patch.position?.trim() || null));
    put('location', patch.location === undefined ? undefined : (patch.location?.trim() || null));
    put('hireDate', patch.hireDate);
    put('status', patch.status);
    try {
      const q = EmployeeModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}), $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = EmployeeModel.findOne({ tenantId, _id: id });
        if (s) existsQ.session(s);
        const exists = await existsQ.exec();
        if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
        return null;
      }
      return toEmployee(updated);
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

export class MongoTimeOffStore implements ITimeOffStore {
  private readonly base = new TimeOffBaseRepo(TimeOffModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<TimeOff | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toTimeOff(doc) : null;
  }

  async list(tenantId: string, filters: TimeOffFilters, page: number, limit: number, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.employeeId) filter.employeeId = filters.employeeId;
    if (filters.status) filter.status = filters.status;
    if (filters.type) filter.type = filters.type;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy, sortOrder }, undefined, { allowedSortFields: TIMEOFF_SORT_FIELDS });
    return {
      data: result.data.map(toTimeOff),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: { tenantId: string; employeeId: string; type: 'VACATION' | 'SICK' | 'PERMISSION'; startDate: string; endDate: string; reason?: string; createdBy: string }, session?: TxSession): Promise<TimeOff> {
    const created = await this.base.create(
      clean({
        employeeId: data.employeeId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
        status: 'PENDING',
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toTimeOff(created);
  }

  private async setStatus(tenantId: string, id: string, to: TimeOffStatus, expectedVersion: number, decidedBy: string, session?: TxSession): Promise<TimeOff | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const set: Record<string, unknown> = {
      status: to,
      updatedBy: decidedBy,
      updatedAt: new Date(),
      decidedBy,
      decidedAt: new Date().toISOString(),
    };
    try {
      const q = TimeOffModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = TimeOffModel.findOne({ tenantId, _id: id });
        if (s) existsQ.session(s);
        const exists = await existsQ.exec();
        if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
        return null;
      }
      return toTimeOff(updated);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async decide(tenantId: string, id: string, to: TimeOffStatus, expectedVersion: number, decidedBy: string, session?: TxSession): Promise<TimeOff | null> {
    return this.setStatus(tenantId, id, to, expectedVersion, decidedBy, session);
  }

  async cancel(tenantId: string, id: string, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<TimeOff | null> {
    return this.setStatus(tenantId, id, 'CANCELLED', expectedVersion, updatedBy, session);
  }
}
