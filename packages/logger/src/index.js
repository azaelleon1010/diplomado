"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
exports.childLogger = childLogger;
exports.redactSecrets = redactSecrets;
const pino_1 = __importDefault(require("pino"));
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const isProduction = process.env.NODE_ENV === 'production';
function createLogger(name = 'erp') {
    return (0, pino_1.default)({
        name,
        level,
        formatters: {
            level(label) {
                return { level: label };
            },
        },
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
        // In production emit JSON; locally use pino-pretty via transport if available
        transport: !isProduction
            ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
            : undefined,
        base: { service: name, env: process.env.NODE_ENV || 'development' },
    });
}
exports.logger = createLogger('erp-platform');
function childLogger(context) {
    return exports.logger.child(context);
}
function redactSecrets(obj) {
    const secretKeys = new Set(['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization', 'jwt', 'encryptionKey']);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (secretKeys.has(k.toLowerCase()))
            out[k] = '[REDACTED]';
        else
            out[k] = v;
    }
    return out;
}
//# sourceMappingURL=index.js.map