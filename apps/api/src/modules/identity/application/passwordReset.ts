/**
 * Password reset use cases — orchestrate ports, enforce business rules.
 * No Express, no Mongoose here.
 *
 * Security rules:
 * - Never reveal whether an email exists (both endpoints always succeed
 *   from the caller's point of view; the real outcome only shows up as
 *   "did an email arrive").
 * - The link's secret token is never persisted; only its SHA-256 hash is
 *   stored, same pattern as RefreshSession.tokenHash.
 * - A successful reset revokes every refresh session for that user —
 *   a leaked old session must not survive a password change.
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { getConfig } from '@erp/config';
import { AppError, unauthorized, validationError } from '@erp/errors';
import { AUTH_ACTIONS, sanitizeForAudit, type AuditResult } from '../domain/entities';
import type { IPasswordResetStore } from '../domain/ports';
import type { IdentityDeps, RegisterDeps } from './usecases';

export interface PasswordResetDeps extends RegisterDeps {
  resetTokens: IPasswordResetStore;
}

async function audit(deps: IdentityDeps, event: { tenantId: string; userId?: string; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; result: AuditResult; correlationId?: string }) {
  await deps.audit.record({
    tenantId: event.tenantId,
    userId: event.userId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    before: sanitizeForAudit(event.before),
    after: sanitizeForAudit(event.after),
    result: event.result,
    correlationId: event.correlationId,
  });
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison; mismatched lengths never throw and always fail. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface RequestPasswordResetInput {
  email: string;
  tenantId?: string;
  correlationId?: string;
}

/**
 * Always resolves to the same generic result regardless of whether the
 * email exists, is ambiguous across tenants, or the send itself fails —
 * callers must not be able to use this endpoint to enumerate accounts.
 */
export async function requestPasswordReset(input: RequestPasswordResetInput, deps: PasswordResetDeps): Promise<{ requested: true }> {
  const email = input.email.trim().toLowerCase();
  const candidates = await deps.users.findByEmailAnyTenant(email);

  const candidate = input.tenantId
    ? candidates.find((c) => c.tenantId === input.tenantId)
    // Zero or ambiguous across tenants: nothing we can safely resolve.
    : candidates.length === 1 ? candidates[0] : undefined;

  if (candidate && candidate.status === 'ACTIVE') {
    const tenant = await deps.tenants.findById(candidate.tenantId);
    if (tenant && tenant.status === 'ACTIVE') {
      const ttlMinutes = getConfig().passwordReset.ttlMinutes;
      const resetId = randomUUID();
      const token = randomBytes(32).toString('hex');
      await deps.resetTokens.create({
        tenantId: candidate.tenantId,
        userId: candidate._id,
        resetId,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      });

      const resetUrl = `${getConfig().WEB_APP_URL}/reset-password?rid=${encodeURIComponent(resetId)}&token=${encodeURIComponent(token)}`;
      try {
        await deps.emailProvider.sendPasswordResetEmail({
          to: candidate.email,
          firstName: candidate.firstName,
          resetUrl,
          ttlMinutes,
        });
      } catch (error) {
        // Never surface a send failure to the caller (would reveal the email exists).
        console.warn('Password reset email could not be sent', {
          email: candidate.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await audit(deps, {
        tenantId: candidate.tenantId,
        userId: candidate._id,
        action: AUTH_ACTIONS.PASSWORD_RESET_REQUESTED,
        entityType: 'user',
        entityId: candidate._id,
        result: 'SUCCESS',
        correlationId: input.correlationId,
        after: { email: candidate.email },
      });
    }
  }

  return { requested: true };
}

/** Generic message for every invalid/expired/used reset link — never reveals which case it was. */
const INVALID_RESET_LINK = 'This password reset link is invalid or has expired';

export interface ResetPasswordInput {
  resetId: string;
  token: string;
  newPassword: string;
  correlationId?: string;
}

export async function resetPassword(input: ResetPasswordInput, deps: PasswordResetDeps): Promise<{ success: true }> {
  if (input.newPassword.length < 8) {
    throw validationError('Password must be at least 8 characters');
  }

  const record = await deps.resetTokens.findByResetId(input.resetId.trim());
  const fail = () => {
    throw unauthorized(INVALID_RESET_LINK);
  };
  if (!record) return fail();
  if (record.usedAt) return fail();
  if (record.expiresAt.getTime() <= Date.now()) return fail();
  if (!safeEqual(record.tokenHash, hashResetToken(input.token))) return fail();

  const user = await deps.users.findById(record.tenantId, record.userId);
  if (!user || user.status !== 'ACTIVE') return fail();
  const tenant = await deps.tenants.findById(record.tenantId);
  if (!tenant || tenant.status !== 'ACTIVE') return fail();

  const passwordHash = await deps.hasher.hash(input.newPassword);
  const updated = await deps.users.setPasswordHash(record.tenantId, record.userId, passwordHash, record.userId);
  if (!updated) throw new AppError({ code: 'NOT_FOUND', message: 'User not found', statusCode: 404 });

  await deps.resetTokens.markUsed(record.resetId);
  // A password change invalidates every existing session — a stolen refresh
  // token must not keep working after the owner resets their password.
  await deps.sessions.revokeAllForUser(record.tenantId, record.userId);

  await audit(deps, {
    tenantId: record.tenantId,
    userId: record.userId,
    action: AUTH_ACTIONS.PASSWORD_RESET_SUCCESS,
    entityType: 'user',
    entityId: record.userId,
    result: 'SUCCESS',
    correlationId: input.correlationId,
  });

  return { success: true };
}
