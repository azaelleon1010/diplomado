"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyMongoError = classifyMongoError;
exports.connectMongo = connectMongo;
exports.disconnectMongo = disconnectMongo;
exports.getMongoConnection = getMongoConnection;
exports.getConnectionState = getConnectionState;
exports.isConnected = isConnected;
/**
 * MongoDB Atlas connection manager — single pool, lifecycle-aware.
 * Belongs to Infrastructure layer. Business modules must NOT call mongoose directly.
 */
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("@erp/config");
const logger_1 = require("@erp/logger");
const logger = (0, logger_1.createLogger)('database:mongodb');
let connecting = null;
let connected = false;
function classifyMongoError(err) {
    const error = err && typeof err === 'object' ? err : {};
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
    const cfg = (0, config_1.getMongoConfig)();
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
async function connectMongo() {
    if (connected && mongoose_1.default.connection.readyState === 1)
        return mongoose_1.default;
    if (connecting)
        return connecting;
    const cfg = (0, config_1.getMongoConfig)();
    if (!cfg.uri || cfg.uri.trim() === '') {
        throw new Error('MONGODB_URI is required but not set');
    }
    mongoose_1.default.set('strictQuery', true);
    logger.info({ dbName: cfg.dbName, maxPoolSize: cfg.maxPoolSize, minPoolSize: cfg.minPoolSize }, 'MongoDB connecting');
    connecting = mongoose_1.default
        .connect(cfg.uri, buildOptions())
        .then((m) => {
        connected = true;
        connecting = null;
        logger.info({ host: m.connection.host, name: m.connection.name }, 'MongoDB connected');
        // lifecycle listeners (once)
        mongoose_1.default.connection.on('error', (err) => {
            const failure = classifyMongoError(err);
            logger.error({ reason: failure.reason, code: failure.code }, 'MongoDB error');
        });
        mongoose_1.default.connection.on('disconnected', () => {
            connected = false;
            logger.warn('MongoDB disconnected');
        });
        mongoose_1.default.connection.on('reconnected', () => {
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
async function disconnectMongo() {
    if (mongoose_1.default.connection.readyState !== 0) {
        logger.info('MongoDB disconnecting');
        await mongoose_1.default.disconnect();
        connected = false;
        connecting = null;
        logger.info('MongoDB disconnected (graceful)');
    }
}
function getMongoConnection() {
    return mongoose_1.default;
}
function getConnectionState() {
    const map = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting', 99: 'uninitialized' };
    return { readyState: mongoose_1.default.connection.readyState, label: map[mongoose_1.default.connection.readyState] ?? 'unknown', connected };
}
function isConnected() {
    return mongoose_1.default.connection.readyState === 1;
}
//# sourceMappingURL=connection.js.map