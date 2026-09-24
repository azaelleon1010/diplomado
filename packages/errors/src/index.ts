export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TENANT_ISOLATION_VIOLATION'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CLOSED_PERIOD'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'UNBALANCED_JOURNAL'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly fields?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(opts: { code: ErrorCode; message: string; statusCode: number; fields?: Record<string, unknown>; cause?: unknown }) {
    super(opts.message);
    this.name = 'AppError';
    this.code = opts.code;
    this.statusCode = opts.statusCode;
    this.fields = opts.fields;
    this.isOperational = true;
    if (opts.cause) (this as unknown as { cause: unknown }).cause = opts.cause;
  }
}

export function validationError(message: string, fields?: Record<string, unknown>) {
  return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}
export function unauthorized(message = 'Unauthorized') {
  return new AppError({ code: 'UNAUTHORIZED', message, statusCode: 401 });
}
export function forbidden(message = 'Forbidden') {
  return new AppError({ code: 'FORBIDDEN', message, statusCode: 403 });
}
export function notFound(message = 'Not found') {
  return new AppError({ code: 'NOT_FOUND', message, statusCode: 404 });
}
export function conflict(code: ErrorCode = 'CONFLICT', message = 'Conflict') {
  return new AppError({ code, message, statusCode: 409 });
}
export function versionConflict(currentVersion: number) {
  return new AppError({ code: 'VERSION_CONFLICT', message: `Version conflict. Current version is ${currentVersion}`, statusCode: 409, fields: { currentVersion } });
}
export function internalError(message = 'Internal server error') {
  return new AppError({ code: 'INTERNAL_ERROR', message, statusCode: 500 });
}

export function toErrorResponse(err: AppError, traceId: string) {
  return {
    success: false as const,
    error: { code: err.code, message: err.message, fields: err.fields ?? {} },
    traceId,
  };
}
