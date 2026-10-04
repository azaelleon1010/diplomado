/**
 * JwtIssuer — ITokenIssuer backed by jsonwebtoken.
 * Access: 15m default. Refresh: 7d default, bound to a stored session.
 */
import { createHash, randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { AppError } from '@erp/errors';
import { getConfig } from '@erp/config';
import type { AccessClaims, ITokenIssuer, IssuedRefresh, RefreshClaims } from '../domain/ports';

function parseDurationToSeconds(raw: string, fallback: number): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(raw.trim());
  if (!m) return fallback;
  const value = Number(m[1]);
  const unit = m[2];
  if (unit === 's') return value;
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 3600;
  return value * 86400;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export class JwtIssuer implements ITokenIssuer {
  accessTtlSeconds(): number {
    return parseDurationToSeconds(getConfig().JWT_EXPIRES_IN, 900);
  }

  refreshTtlSeconds(): number {
    return parseDurationToSeconds(getConfig().JWT_REFRESH_EXPIRES_IN, 604800);
  }

  issueAccess(input: { userId: string; tenantId: string; sessionId: string }): string {
    const secret = getConfig().JWT_SECRET;
    const options: SignOptions = { expiresIn: this.accessTtlSeconds() };
    return jwt.sign(
      { sub: input.userId, tenantId: input.tenantId, sessionId: input.sessionId, type: 'access', jti: randomUUID() },
      secret,
      options,
    );
  }

  issueRefresh(input: { userId: string; tenantId: string; sessionId: string }): IssuedRefresh {
    const secret = getConfig().JWT_SECRET;
    const ttl = this.refreshTtlSeconds();
    const options: SignOptions = { expiresIn: ttl };
    const token = jwt.sign(
      { sub: input.userId, tenantId: input.tenantId, sessionId: input.sessionId, type: 'refresh', jti: randomUUID() },
      secret,
      options,
    );
    return { token, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  verifyAccess(token: string): AccessClaims {
    const payload = this.verify(token, 'access');
    return { sub: payload.sub, tenantId: payload.tenantId, sessionId: payload.sessionId, type: 'access' };
  }

  verifyRefresh(token: string): RefreshClaims {
    const payload = this.verify(token, 'refresh');
    return { sub: payload.sub, tenantId: payload.tenantId, sessionId: payload.sessionId, type: 'refresh' };
  }

  private verify(token: string, expectedType: 'access' | 'refresh'): { sub: string; tenantId: string; sessionId: string } {
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, getConfig().JWT_SECRET);
    } catch {
      throw new AppError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token', statusCode: 401 });
    }
    if (!isRecord(decoded)) {
      throw new AppError({ code: 'UNAUTHORIZED', message: 'Invalid token claims', statusCode: 401 });
    }
    const sub = decoded.sub;
    const tenantId = decoded.tenantId;
    const sessionId = decoded.sessionId;
    const type = decoded.type;
    if (typeof sub !== 'string' || sub.length === 0 || typeof tenantId !== 'string' || tenantId.length === 0 || typeof sessionId !== 'string' || sessionId.length === 0 || type !== expectedType) {
      throw new AppError({ code: 'UNAUTHORIZED', message: 'Invalid token claims', statusCode: 401 });
    }
    return { sub, tenantId, sessionId };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
