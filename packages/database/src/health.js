"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pingMongo = pingMongo;
exports.getMongoStatus = getMongoStatus;
const mongoose_1 = __importDefault(require("mongoose"));
const connection_1 = require("./connection");
async function pingMongo() {
    const start = Date.now();
    try {
        if (mongoose_1.default.connection.readyState !== 1) {
            const s = (0, connection_1.getConnectionState)();
            return { status: 'down', latencyMs: Date.now() - start, message: `not connected (${s.label})` };
        }
        await mongoose_1.default.connection.db?.admin().ping();
        return { status: 'ok', latencyMs: Date.now() - start };
    }
    catch (err) {
        const failure = (0, connection_1.classifyMongoError)(err);
        return { status: 'down', latencyMs: Date.now() - start, message: failure.reason };
    }
}
function getMongoStatus() {
    const s = (0, connection_1.getConnectionState)();
    if (s.readyState === 1)
        return { status: 'ok' };
    if (s.readyState === 2)
        return { status: 'down', message: 'connecting' };
    return { status: 'down', message: s.label };
}
//# sourceMappingURL=health.js.map