import { Logger } from 'pino';
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
export declare function createLogger(name?: string): Logger;
export declare const logger: Logger;
export declare function childLogger(context: LogContext): Logger;
export declare function redactSecrets(obj: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=index.d.ts.map