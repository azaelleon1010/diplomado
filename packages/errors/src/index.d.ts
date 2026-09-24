export type ErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'TENANT_ISOLATION_VIOLATION' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'CLOSED_PERIOD' | 'CREDIT_LIMIT_EXCEEDED' | 'UNBALANCED_JOURNAL' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
export declare class AppError extends Error {
    readonly code: ErrorCode;
    readonly statusCode: number;
    readonly fields?: Record<string, unknown>;
    readonly isOperational: boolean;
    constructor(opts: {
        code: ErrorCode;
        message: string;
        statusCode: number;
        fields?: Record<string, unknown>;
        cause?: unknown;
    });
}
export declare function validationError(message: string, fields?: Record<string, unknown>): AppError;
export declare function unauthorized(message?: string): AppError;
export declare function forbidden(message?: string): AppError;
export declare function notFound(message?: string): AppError;
export declare function conflict(code?: ErrorCode, message?: string): AppError;
export declare function versionConflict(currentVersion: number): AppError;
export declare function internalError(message?: string): AppError;
export declare function toErrorResponse(err: AppError, traceId: string): {
    success: false;
    error: {
        code: ErrorCode;
        message: string;
        fields: Record<string, unknown>;
    };
    traceId: string;
};
//# sourceMappingURL=index.d.ts.map