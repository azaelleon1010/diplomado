/**
 * MongoDB Atlas connection manager — single pool, lifecycle-aware.
 * Belongs to Infrastructure layer. Business modules must NOT call mongoose directly.
 */
import mongoose from 'mongoose';
import { getMongoConfig } from '@erp/config';
import { createLogger } from '@erp/logger';

const logger = createLogger('database:mongodb');

let connecting: Promise<typeof mongoose> | null = null;
let connected = false;

export type MongoFailureReason =
  | 'uri'
  | 'dns'
  | 'ip_access_list'
  | 'authentication'
  | 'auth_source'
  | 'tls'
  | 'cluster'
  | 'network'
  | 'driver'
  | 'unknown';

export function classifyMongoError(err: unknown): { reason: MongoFailureReason; code?: string } {
  const error = err && typeof err === 'object' ? err as Record<string, unknown> : {};
  const name = typeof error.name === 'string' ? error.name : '';
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const code = typeof error.code === 'string' ? error.code : undefined;

  if (name === 'MongoParseError' || message.includes('invalid scheme') || message.includes('connection string')) {
    return { reason: 'uri', code };
  }
  if (code === 'ENOTFOUND' || message.includes('getaddrinfo') || message.includes('enotfound')) {
    return { reason: 'dns', code };
  }
  if (message.includes('not authorized') || message.includes('authentication failed') || message.includes('bad auth')) {
    return { reason: 'authentication', code };
  }
  if (message.includes('authsource') || message.includes('authentication database')) {
    return { reason: 'auth_source', code };
  }
  if (message.includes('ip access list') || message.includes('whitelist') || message.includes('not allowed to access')) {
    return { reason: 'ip_access_list', code };
  }
  if (message.includes('tls') || message.includes('ssl') || message.includes('certificate')) {
    return { reason: 'tls', code };
  }
  if (name === 'MongooseServerSelectionError' || message.includes('server selection') || message.includes('timed out')) {
    return { reason: 'cluster', code };
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || message.includes('network') || message.includes('socket') || message.includes('econnreset')) {
    return { reason: 'network', code };
  }
  if (name.startsWith('Mongo') || name.startsWith('Mongoose')) {
    return { reason: 'driver', code };
  }
  return { reason: 'unknown', code };
}

function buildOptions() {
  const cfg = getMongoConfig();
  return {
    dbName: cfg.dbName,
    maxPoolSize: cfg.maxPoolSize,
    minPoolSize: cfg.minPoolSize,
    serverSelectionTimeoutMS: cfg.serverSelectionTimeoutMS,
    socketTimeoutMS: cfg.socketTimeoutMS,
    maxIdleTimeMS: cfg.maxIdleTimeMS,
    // Atlas-ready defaults: TLS auto-negotiated via srv URI; retryWrites handled by driver
    retryWrites: true,
    retryReads: true,
    autoIndex: process.env.NODE_ENV !== 'production', // in prod manage indexes via migrations
  };
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (connected && mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  const cfg = getMongoConfig();
  if (!cfg.uri || cfg.uri.trim() === '') {
    throw new Error('MONGODB_URI is required but not set');
  }

  mongoose.set('strictQuery', true);
  logger.info({ dbName: cfg.dbName, maxPoolSize: cfg.maxPoolSize, minPoolSize: cfg.minPoolSize }, 'MongoDB connecting');

  connecting = mongoose
    .connect(cfg.uri, buildOptions() as Parameters<typeof mongoose.connect>[1])
    .then((m) => {
      connected = true;
      connecting = null;
      logger.info({ host: m.connection.host, name: m.connection.name }, 'MongoDB connected');
      // lifecycle listeners (once)
      mongoose.connection.on('error', (err) => {
        const failure = classifyMongoError(err);
        logger.error({ reason: failure.reason, code: failure.code }, 'MongoDB error');
      });
      mongoose.connection.on('disconnected', () => {
        connected = false;
        logger.warn('MongoDB disconnected');
      });
      mongoose.connection.on('reconnected', () => {
        connected = true;
        logger.info('MongoDB reconnected');
      });
      return m;
    })
    .catch((err) => {
      connecting = null;
      const failure = classifyMongoError(err);
      logger.error({ reason: failure.reason, code: failure.code }, 'MongoDB connection failed');
      throw err;
    });

  return connecting;
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    logger.info('MongoDB disconnecting');
    await mongoose.disconnect();
    connected = false;
    connecting = null;
    logger.info('MongoDB disconnected (graceful)');
  }
}

export function getMongoConnection(): typeof mongoose {
  return mongoose;
}

export function getConnectionState(): { readyState: number; label: string; connected: boolean } {
  const map: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting', 99: 'uninitialized' };
  return { readyState: mongoose.connection.readyState, label: map[mongoose.connection.readyState] ?? 'unknown', connected };
}

export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
