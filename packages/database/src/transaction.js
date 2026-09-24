"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = withTransaction;
exports.sessionOrNull = sessionOrNull;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("@erp/logger");
const logger = (0, logger_1.createLogger)('database:transaction');
/**
 * Run callback inside a MongoDB transaction.
 * Caller receives ClientSession to pass to repositories.
 * Retries not included — driver handles transient retryWrites.
 */
async function withTransaction(fn, opts = {}) {
    const session = await mongoose_1.default.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await fn(session);
        }, {
            readConcern: opts.readConcern ? { level: opts.readConcern } : undefined,
            writeConcern: opts.writeConcern ? { w: opts.writeConcern } : { w: 'majority' },
            maxTimeMS: opts.maxTimeMS,
        });
        logger.debug('transaction committed');
        return result;
    }
    catch (err) {
        logger.warn({ err: err.message }, 'transaction aborted');
        throw err;
    }
    finally {
        await session.endSession();
    }
}
/**
 * Helper to optionally attach session to Mongoose queries.
 * Usage: query.session(sessionIfPresent)
 */
function sessionOrNull(session) {
    return session ?? null;
}
//# sourceMappingURL=transaction.js.map