import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { envBoolean } from "./parsers";

// Load .env from the monorepo root.
// __dirname resolves to the directory containing this file (packages/config/src).
const repoRoot = resolve(__dirname, '../../../');
dotenv.config({ path: resolve(repoRoot, '.env'), override: false });

/**
 * Centralized config validation.
 * MongoDB Atlas is System of Record — URI must be explicit.
 * Supports both legacy MONGODB_DB_NAME and canonical MONGODB_DATABASE.
 */
const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_VERSION: z.string().default('v1'),
  TRACE_HEADER: z.string().default('x-trace-id'),
  REQUEST_ID_HEADER: z.string().default('x-request-id'),

  // MongoDB — primary (Atlas). MONGODB_DATABASE takes precedence over MONGODB_DB_NAME
  MONGODB_URI: z.string().min(1),
  MONGODB_DATABASE: z.string().optional(),
  MONGODB_DB_NAME: z.string().default('erp_platform'),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().int().min(0).max(50).default(2),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  MONGODB_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(45000),
  MONGODB_MAX_IDLE_TIME_MS: z.coerce.number().int().min(1000).max(300000).default(30000),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PREFIX: z.string().default('erp:'),
  REDIS_ENABLED: envBoolean.default(false),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().int().min(0).max(10).default(3),

  JWT_SECRET: z.string().min(32).default('change-me-32-chars-minimum-jwt-secret-dev-only!!'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  ENCRYPTION_KEY: z.string().min(16).default('change-me-32-chars-encryption-key!!'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3001'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  BULLMQ_PREFIX: z.string().default('erp:bull'),
});

const transformedSchema = rawSchema.transform((raw) => {
  const database = raw.MONGODB_DATABASE?.trim() ? raw.MONGODB_DATABASE.trim() : raw.MONGODB_DB_NAME;
  const {
    PORT,
    REDIS_URL,
    REDIS_PREFIX,
    REDIS_ENABLED,
    REDIS_MAX_RETRIES_PER_REQUEST,
    ...settings
  } = raw;
  return {
    ...settings,
    MONGODB_DATABASE: database,
    MONGODB_DB_NAME: database, // keep legacy alias synced
    server: { port: PORT },
    redis: {
      url: REDIS_URL,
      prefix: REDIS_PREFIX,
      enabled: REDIS_ENABLED,
      maxRetriesPerRequest: REDIS_MAX_RETRIES_PER_REQUEST,
    },
  };
});

export type AppConfig = z.infer<typeof transformedSchema>;

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  console.log(
    "DEBUG REDIS_ENABLED:",
    JSON.stringify(process.env.REDIS_ENABLED),
    "TYPE:",
    typeof process.env.REDIS_ENABLED
  );
  const parsed = transformedSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${msg}`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === 'production' && cfg.JWT_SECRET.includes('change-me')) {
    throw new Error('JWT_SECRET must be set to a secure value in production');
  }
  if (cfg.NODE_ENV === 'production' && cfg.MONGODB_URI.includes('localhost')) {
    // warn but not fail — Atlas should be used in prod, but allow localhost for staging
  }
  cached = cfg;
  return cached;
}

export function isProduction(): boolean { return getConfig().NODE_ENV === 'production'; }
export function isTest(): boolean { return getConfig().NODE_ENV === 'test'; }

/** For tests only — clears cached config so next getConfig re-reads env */
export function __resetConfigForTests(): void { cached = null; }

export function getMongoConfig() {
  const c = getConfig();
  return {
    uri: c.MONGODB_URI,
    dbName: c.MONGODB_DATABASE,
    maxPoolSize: c.MONGODB_MAX_POOL_SIZE,
    minPoolSize: c.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: c.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: c.MONGODB_SOCKET_TIMEOUT_MS,
    maxIdleTimeMS: c.MONGODB_MAX_IDLE_TIME_MS,
  };
}

export function isRedisEnabled(): boolean { return getConfig().redis.enabled; }
export function getRedisConfig() {
  return getConfig().redis;
}
