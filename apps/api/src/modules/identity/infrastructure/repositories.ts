/**
 * Identity stores — Infrastructure implementations of domain ports.
 *
 * Each store composes a BaseRepository (tenant isolation inherited,
 * never duplicated) and exposes the narrow port interface. Composition
 * (instead of inheritance) keeps port signatures independent from the
 * generic base signatures.
 */
import { BaseRepository, mapMongoError, type TenantContext } from '@erp/database';
import type { ClientSession } from 'mongoose';
import type {
  IAuditSink,
  IMembershipStore,
  IRoleStore,
  ISessionStore,
  IUserStore,
  TxSession,
  CreateUserData,
} from '../domain/ports';
import type { Membership, RefreshSession, Role, UserWithCredentials, User } from '../domain/entities';
import {
  AuditEventModel,
  MembershipModel,
  RefreshSessionModel,
  RoleModel,
  UserModel,
  type AuditEventDoc,
  type MembershipDoc,
  type RefreshSessionDoc,
  type RoleDoc,
  type UserDoc,
} from './models';

const oid = (v: unknown): string => String(v);
const sysCtx = (tenantId: string): TenantContext => ({ tenantId, userId: 'system' });

function toUser(doc: UserDoc): UserWithCredentials {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    username: doc.username,
    email: doc.email,
    passwordHash: doc.passwordHash,
    firstName: doc.firstName,
    lastName: doc.lastName,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toRole(doc: RoleDoc): Role {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    name: doc.name,
    description: doc.description,
    permissions: [...doc.permissions],
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toMembership(doc: MembershipDoc): Membership {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    organizationId: doc.organizationId,
    branchId: doc.branchId,
    userId: doc.userId,
    roleIds: [...doc.roleIds],
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toSession(doc: RefreshSessionDoc): RefreshSession {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    userId: doc.userId,
    sessionId: doc.sessionId,
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

class UserBaseRepo extends BaseRepository<UserDoc> {}
class RoleBaseRepo extends BaseRepository<RoleDoc> {}
class MembershipBaseRepo extends BaseRepository<MembershipDoc> {}

const USER_SORT_FIELDS = ['createdAt', 'updatedAt', 'email', 'username'];

export class MongoUserStore implements IUserStore {
  private readonly base = new UserBaseRepo(UserModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<UserWithCredentials | null> {
    // passwordHash has select:false — explicitly include it for auth flows.
    const query = UserModel.findOne({ tenantId, _id: id }).select('+passwordHash');
    if (session) query.session(session as ClientSession);
    const doc = await query.exec().catch((err) => { throw mapMongoError(err); });
    return doc ? toUser(doc) : null;
  }

  async findByEmail(tenantId: string, email: string, session?: TxSession): Promise<UserWithCredentials | null> {
    const query = UserModel.findOne({ tenantId, email: email.toLowerCase() }).select('+passwordHash');
    if (session) query.session(session as ClientSession);
    const doc = await query.exec().catch((err) => { throw mapMongoError(err); });
    return doc ? toUser(doc) : null;
  }

  async findByEmailAnyTenant(email: string): Promise<UserWithCredentials[]> {
    // Identity resolution only (login). Never used for data access.
    const docs = await UserModel.find({ email: email.toLowerCase() }).select('+passwordHash').exec().catch((err) => { throw mapMongoError(err); });
    return docs.map(toUser);
  }

  async create(data: CreateUserData, session?: TxSession): Promise<UserWithCredentials> {
    const created = await this.base.create(
      {
        username: data.username,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        status: 'ACTIVE',
      },
      { tenantId: data.tenantId, userId: data.createdBy },
      session as ClientSession | undefined,
    );
    const withHash = await this.findById(data.tenantId, oid(created._id), session);
    if (!withHash) throw new Error('User creation failed');
    return withHash;
  }

  async setStatus(tenantId: string, id: string, status: User['status'], updatedBy: string): Promise<UserWithCredentials | null> {
    const current = await this.findById(tenantId, id);
    if (!current) return null;
    await this.base.updateById(id, { status }, { tenantId, userId: updatedBy }, current.version);
    return this.findById(tenantId, id);
  }

  async list(tenantId: string, page: number, limit: number) {
    const result = await this.base.findMany({}, sysCtx(tenantId), { page, limit, sortBy: 'createdAt', sortOrder: 'desc' }, undefined, { allowedSortFields: USER_SORT_FIELDS });
    return {
      data: result.data.map((d) => {
        const { passwordHash, ...safe } = toUser(d);
        void passwordHash;
        return safe;
      }),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}

export class MongoRoleStore implements IRoleStore {
  private readonly base = new RoleBaseRepo(RoleModel);

  async findById(tenantId: string, id: string): Promise<Role | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId));
    return doc ? toRole(doc) : null;
  }

  async findByIds(tenantId: string, ids: string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    try {
      const docs = await RoleModel.find({ tenantId, _id: { $in: ids } }).exec();
      return docs.map(toRole);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findByName(tenantId: string, name: string): Promise<Role | null> {
    try {
      const doc = await RoleModel.findOne({ tenantId, name }).exec();
      return doc ? toRole(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async create(data: { tenantId: string; name: string; description?: string; permissions: string[]; createdBy: string }, session?: TxSession): Promise<Role> {
    const created = await this.base.create(
      { name: data.name, description: data.description, permissions: data.permissions, status: 'ACTIVE' },
      { tenantId: data.tenantId, userId: data.createdBy },
      session as ClientSession | undefined,
    );
    return toRole(created);
  }

  async list(tenantId: string): Promise<Role[]> {
    try {
      const docs = await RoleModel.find({ tenantId }).sort({ name: 1 }).exec();
      return docs.map(toRole);
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

export class MongoMembershipStore implements IMembershipStore {
  private readonly base = new MembershipBaseRepo(MembershipModel);

  async findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null> {
    try {
      const found = await MembershipModel.findOne({ tenantId, userId }).exec();
      return found ? toMembership(found) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findActiveByUser(userId: string): Promise<Membership[]> {
    try {
      const docs = await MembershipModel.find({ userId, status: 'ACTIVE' }).exec();
      return docs.map(toMembership);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async create(data: { tenantId: string; organizationId?: string; branchId?: string; userId: string; roleIds: string[]; createdBy: string }, session?: TxSession): Promise<Membership> {
    const created = await this.base.create(
      {
        organizationId: data.organizationId,
        branchId: data.branchId,
        userId: data.userId,
        roleIds: data.roleIds,
        status: 'ACTIVE',
      },
      { tenantId: data.tenantId, organizationId: data.organizationId, branchId: data.branchId, userId: data.createdBy },
      session as ClientSession | undefined,
    );
    return toMembership(created);
  }

  async setRoles(tenantId: string, membershipId: string, roleIds: string[], updatedBy: string): Promise<Membership | null> {
    const current = await this.base.findById(membershipId, { tenantId, userId: updatedBy });
    if (!current) return null;
    const updated = await this.base.updateById(membershipId, { roleIds }, { tenantId, userId: updatedBy }, current.version);
    return toMembership(updated);
  }
}

export class MongoSessionStore implements ISessionStore {
  async create(data: { tenantId: string; userId: string; sessionId: string; tokenHash: string; expiresAt: Date }, session?: TxSession): Promise<RefreshSession> {
    try {
      const [created] = await RefreshSessionModel.create([{
        tenantId: data.tenantId,
        userId: data.userId,
        sessionId: data.sessionId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        revokedAt: null,
        createdBy: data.userId,
        updatedBy: data.userId,
        version: 1,
      }], session ? { session: session as ClientSession } : {});
      return toSession(created);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findBySessionId(sessionId: string): Promise<RefreshSession | null> {
    // sessionId is a random UUID (unguessable); lookup is global by design.
    try {
      const doc = await RefreshSessionModel.findOne({ sessionId }).exec();
      return doc ? toSession(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async revoke(sessionId: string): Promise<void> {
    try {
      await RefreshSessionModel.updateOne({ sessionId, revokedAt: null }, { $set: { revokedAt: new Date() } }).exec();
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async revokeAllForUser(tenantId: string, userId: string): Promise<void> {
    try {
      await RefreshSessionModel.updateMany({ tenantId, userId, revokedAt: null }, { $set: { revokedAt: new Date() } }).exec();
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

export class MongoAuditSink implements IAuditSink {
  async record(event: { tenantId: string; userId?: string; action: string; entityType?: string; entityId?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; result: 'SUCCESS' | 'FAILURE'; correlationId?: string }, session?: TxSession): Promise<void> {
    try {
      const doc: Partial<AuditEventDoc> = {
        tenantId: event.tenantId,
        userId: event.userId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        before: event.before,
        after: event.after,
        result: event.result,
        correlationId: event.correlationId,
        createdBy: event.userId ?? 'system',
        updatedBy: event.userId ?? 'system',
        version: 1,
      };
      await AuditEventModel.create([doc], session ? { session: session as ClientSession } : {});
    } catch {
      // Audit must never break the business flow; failure is logged by the caller context.
    }
  }
}
