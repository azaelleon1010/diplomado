"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapMongoError = mapMongoError;
const mongoose_1 = __importDefault(require("mongoose"));
const errors_1 = require("@erp/errors");
/**
 * Map low-level Mongo/Mongoose errors to business AppErrors.
 * Never leak raw E11000 or stack to client.
 */
function mapMongoError(err) {
    if (err instanceof errors_1.AppError)
        return err;
    // Duplicate key (unique index)
    if (isMongoDuplicateKey(err)) {
        const keyValue = err.keyValue;
        const keyPattern = err.keyPattern;
        const fields = keyValue ?? keyPattern ?? {};
        const fieldNames = Object.keys(fields).join(', ') || 'unique field';
        return new errors_1.AppError({
            code: 'CONFLICT',
            message: `Duplicate value for ${fieldNames}`,
            statusCode: 409,
            fields: { duplicateFields: fields },
        });
    }
    // Validation
    if (err instanceof mongoose_1.default.Error.ValidationError) {
        const fields = {};
        for (const [k, v] of Object.entries(err.errors))
            fields[k] = v.message;
        return new errors_1.AppError({ code: 'VALIDATION_ERROR', message: 'Validation failed', statusCode: 400, fields });
    }
    // CastError (invalid ObjectId)
    if (err instanceof mongoose_1.default.Error.CastError) {
        return new errors_1.AppError({ code: 'VALIDATION_ERROR', message: `Invalid value for ${err.path}: ${err.value}`, statusCode: 400, fields: { path: err.path } });
    }
    // Version conflict (optimistic concurrency)
    if (isVersionError(err)) {
        return new errors_1.AppError({ code: 'VERSION_CONFLICT', message: 'Document was modified by another request. Please reload and retry.', statusCode: 409 });
    }
    // Timeout / unavailable
    if (isTimeoutError(err)) {
        return new errors_1.AppError({ code: 'INTERNAL_ERROR', message: 'Database temporarily unavailable', statusCode: 503 });
    }
    const message = err instanceof Error ? err.message : 'Database error';
    return new errors_1.AppError({ code: 'INTERNAL_ERROR', message, statusCode: 500 });
}
function isMongoDuplicateKey(err) {
    if (!err || typeof err !== 'object')
        return false;
    const e = err;
    return e.code === 11000 || e.code === 11001 || (typeof e.message === 'string' && e.message.includes('E11000'));
}
function isVersionError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const e = err;
    return e.name === 'VersionError' || e.name === 'OptimisticConcurrencyError';
}
function isTimeoutError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const e = err;
    const msg = e.message || '';
    return msg.includes('ServerSelectionTimeout') || msg.includes('timed out') || e.name === 'MongooseServerSelectionError';
}
//# sourceMappingURL=errors.js.map