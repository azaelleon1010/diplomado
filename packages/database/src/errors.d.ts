import { AppError } from '@erp/errors';
/**
 * Map low-level Mongo/Mongoose errors to business AppErrors.
 * Never leak raw E11000 or stack to client.
 */
export declare function mapMongoError(err: unknown): AppError;
//# sourceMappingURL=errors.d.ts.map