import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { envBoolean } from './parsers';

// Load .env from the monorepo root.
const repoRoot = resolve(__dirname, '../../../');
dotenv.config({ path: resolve(repoRoot, '.env'), override: false });

/**
 * Centralized config validation.
 * MongoDB Atlas is System of Record — URI must be explicit.
 */
const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_VERSION: z.string().default('v1'),
  TRACE_HEADER: z.string().default('x-trace-id'),
  REQUEST_ID_HEADER: z.string().default('x-request-id'),

  // MongoDB
  MONGODB_URI: z.string().min(1),
  MONGODB_DATABASE: z.string().optional(),
  MONGODB_DB_NAME: z.string().default('erp_platform'),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().int().min(0).max(50).default(2),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  MONGODB_SOCKET_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(45000),
  MONGODB_MAX_IDLE_TIME_MS: z.coerce.number().int().min(1000).max(300000).default(30000),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PREFIX: z.string().default('erp:'),
  REDIS_ENABLED: envBoolean.default(false),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().int().min(0).max(10).default(3),

  // Auth
  JWT_SECRET: z.string().min(32).default('change-me-32-chars-minimum-jwt-secret-dev-only!!'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  ENCRYPTION_KEY: z.string().min(16).default('change-me-32-chars-encryption-key!!'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3001'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().positive().default(100),
  // Proxy hops to trust for req.ip ("false", "true" or a hop count).
  // Unset: 1 in production (Render's TLS proxy), none elsewhere.
  TRUST_PROXY: z.string().trim().regex(/^(true|false|\d+)$/).optional(),
  // Fixed-window limits for public auth endpoints (in-memory, per instance).
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
  AUTH_LOGIN_MAX_PER_ACCOUNT: z.coerce.number().int().min(1).default(10),
  AUTH_LOGIN_MAX_PER_IP: z.coerce.number().int().min(1).default(100),
  AUTH_REGISTER_MAX_PER_IP: z.coerce.number().int().min(1).default(10),
  AUTH_PUBLIC_MAX_PER_IP: z.coerce.number().int().min(1).default(300),
  // Password reset: link TTL and fixed-window limits (same in-memory limiter).
  AUTH_PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  AUTH_PASSWORD_RESET_MAX_PER_IP: z.coerce.number().int().min(1).default(20),
  AUTH_PASSWORD_RESET_MAX_PER_ACCOUNT: z.coerce.number().int().min(1).default(5),
  // Base URL of the Web app, used to build the password-reset link sent by email.
  WEB_APP_URL: z.string().trim().min(1).default('http://localhost:5173'),
  WORKER_CONCURRENCY: z.coerce.number().positive().default(5),
  BULLMQ_PREFIX: z.string().default('erp:bull'),
});

const transformedSchema = rawSchema.transform((raw) => ({
  ...raw,
  MONGODB_DATABASE: raw.MONGODB_DATABASE?.trim() ? raw.MONGODB_DATABASE.trim() : raw.MONGODB_DB_NAME,
  MONGODB_DB_NAME: raw.MONGODB_DATABASE?.trim() ? raw.MONGODB_DATABASE.trim() : raw.MONGODB_DB_NAME,
  server: {
    port: raw.PORT,
    trustProxy:
      raw.TRUST_PROXY === undefined
        ? raw.NODE_ENV === 'production' ? 1 : false
        : raw.TRUST_PROXY === 'true' ? true : raw.TRUST_PROXY === 'false' ? false : Number(raw.TRUST_PROXY),
  },
  authRateLimit: {
    windowMs: raw.AUTH_RATE_LIMIT_WINDOW_MS,
    loginPerAccount: raw.AUTH_LOGIN_MAX_PER_ACCOUNT,
    loginPerIp: raw.AUTH_LOGIN_MAX_PER_IP,
    registerPerIp: raw.AUTH_REGISTER_MAX_PER_IP,
    publicPerIp: raw.AUTH_PUBLIC_MAX_PER_IP,
    passwordResetPerIp: raw.AUTH_PASSWORD_RESET_MAX_PER_IP,
    passwordResetPerAccount: raw.AUTH_PASSWORD_RESET_MAX_PER_ACCOUNT,
  },
  passwordReset: {
    ttlMinutes: raw.AUTH_PASSWORD_RESET_TTL_MINUTES,
  },
  redis: {
    url: raw.REDIS_URL,
    prefix: raw.REDIS_PREFIX,
    enabled: raw.REDIS_ENABLED,
    maxRetriesPerRequest: raw.REDIS_MAX_RETRIES_PER_REQUEST,
  },
}));

export type AppConfig = z.infer<typeof transformedSchema>;

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = transformedSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${msg}`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === 'production' && cfg.JWT_SECRET.includes('change-me')) {
    throw new Error('JWT_SECRET must be set to a secure value in production');
  }
  cached = cfg;
  return cfg;
}

export function isProduction(): boolean { return getConfig().NODE_ENV === 'production'; }
export function isTest(): boolean { return getConfig().NODE_ENV === 'test'; }
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
  const c = getConfig();
  return { url: c.REDIS_URL, prefix: c.REDIS_PREFIX, enabled: c.redis.enabled, maxRetriesPerRequest: c.redis.maxRetriesPerRequest };
}
export function getServerConfig() { return { port: getConfig().PORT }; }
