import pino, { Logger } from 'pino';

export type LogContext = {
  traceId?: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  module?: string;
  action?: string;
  duration?: number;
  status?: string;
  [key: string]: unknown;
};

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const isProduction = process.env.NODE_ENV === 'production';

export function createLogger(name = 'erp'): Logger {
  return pino({
    name,
    level,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // In production emit JSON; locally use pino-pretty via transport if available
    transport: !isProduction
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
    base: { service: name, env: process.env.NODE_ENV || 'development' },
  });
}

export const logger: Logger = createLogger('erp-platform');

export function childLogger(context: LogContext): Logger {
  return logger.child(context);
}

export function redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const secretKeys = new Set(['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization', 'jwt', 'encryptionKey']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (secretKeys.has(k.toLowerCase())) out[k] = '[REDACTED]';
    else out[k] = v;
  }
  return out;
}
