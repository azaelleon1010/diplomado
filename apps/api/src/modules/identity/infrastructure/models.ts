/**
 * Identity MongoDB models — Infrastructure layer.
 * Shared collections (never one collection per tenant).
 */
import mongoose, { Schema, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions } from '@erp/database';

export interface UserDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  status: 'ACTIVE' | 'DISABLED';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 64 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, trim: true, maxlength: 100 },
    lastName: { type: String, trim: true, maxlength: 100 },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'users' },
);
userSchema.index({ tenantId: 1, email: 1 }, { unique: true, name: 'uniq_tenant_email' });
userSchema.index({ tenantId: 1, username: 1 }, { name: 'idx_tenant_username' });
addTenantIndex(userSchema);

export interface RoleDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  name: string;
  description?: string;
  permissions: string[];
  status: 'ACTIVE' | 'DISABLED';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 64 },
    description: { type: String, trim: true, maxlength: 280 },
    permissions: { type: [String], default: [] },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'roles' },
);
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true, name: 'uniq_tenant_role_name' });
addTenantIndex(roleSchema);

export interface MembershipDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  organizationId?: string;
  branchId?: string;
  userId: string;
  roleIds: string[];
  status: 'ACTIVE' | 'DISABLED';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<MembershipDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    organizationId: { type: String, trim: true, maxlength: 120 },
    branchId: { type: String, trim: true, maxlength: 120 },
    userId: { type: String, required: true, trim: true },
    roleIds: { type: [String], default: [] },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'memberships' },
);
membershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true, name: 'uniq_tenant_member' });
addTenantIndex(membershipSchema);

export interface RefreshSessionDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  userId: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const refreshSessionSchema = new Schema<RefreshSessionDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    userId: { type: String, required: true, trim: true },
    sessionId: { type: String, required: true, trim: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'refreshSessions' },
);
refreshSessionSchema.index({ sessionId: 1 }, { unique: true, name: 'uniq_session_id' });
refreshSessionSchema.index({ tenantId: 1, userId: 1 }, { name: 'idx_tenant_user_sessions' });
// Hygiene: MongoDB removes expired sessions automatically. Revoked-but-unexpired
// sessions persist (needed for reuse detection) until they expire.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expires_at' });
addTenantIndex(refreshSessionSchema);

export interface AuditEventDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  result: 'SUCCESS' | 'FAILURE';
  correlationId?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const auditEventSchema = new Schema<AuditEventDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    userId: { type: String, trim: true },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    entityType: { type: String, trim: true, maxlength: 80 },
    entityId: { type: String, trim: true, maxlength: 120 },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    result: { type: String, enum: ['SUCCESS', 'FAILURE'], required: true },
    correlationId: { type: String, trim: true, maxlength: 120 },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'auditEvents' },
);
auditEventSchema.index({ tenantId: 1, createdAt: -1 }, { name: 'idx_tenant_created' });
auditEventSchema.index({ tenantId: 1, action: 1, createdAt: -1 }, { name: 'idx_tenant_action_created' });
addTenantIndex(auditEventSchema);

function getOrCreate<T extends mongoose.Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const UserModel = getOrCreate<UserDoc>('IdentityUser', userSchema);
export const RoleModel = getOrCreate<RoleDoc>('IdentityRole', roleSchema);
export const MembershipModel = getOrCreate<MembershipDoc>('IdentityMembership', membershipSchema);
export const RefreshSessionModel = getOrCreate<RefreshSessionDoc>('IdentityRefreshSession', refreshSessionSchema);
export const AuditEventModel = getOrCreate<AuditEventDoc>('IdentityAuditEvent', auditEventSchema);

/** Models whose indexes must exist before the API serves traffic. */
export const identityModels = [UserModel, RoleModel, MembershipModel, RefreshSessionModel, AuditEventModel] as unknown as Array<import('mongoose').Model<unknown>>;
