import mongoose from 'mongoose';
import { classifyMongoError, getConnectionState } from './connection';

export type HealthStatus = 'ok' | 'down';

export async function pingMongo(): Promise<{ status: HealthStatus; latencyMs: number; message?: string }> {
  const start = Date.now();
  try {
    if (mongoose.connection.readyState !== 1) {
      const s = getConnectionState();
      return { status: 'down', latencyMs: Date.now() - start, message: `not connected (${s.label})` };
    }
    await mongoose.connection.db?.admin().ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    const failure = classifyMongoError(err);
    return { status: 'down', latencyMs: Date.now() - start, message: failure.reason };
  }
}

export function getMongoStatus(): { status: HealthStatus; message?: string } {
  const s = getConnectionState();
  if (s.readyState === 1) return { status: 'ok' };
  if (s.readyState === 2) return { status: 'down', message: 'connecting' };
  return { status: 'down', message: s.label };
}
