/**
 * MongoDB Atlas connection manager — single pool, lifecycle-aware.
 * Belongs to Infrastructure layer. Business modules must NOT call mongoose directly.
 */
import mongoose from 'mongoose';
export type MongoFailureReason = 'uri' | 'dns' | 'ip_access_list' | 'authentication' | 'auth_source' | 'tls' | 'cluster' | 'network' | 'driver' | 'unknown';
export declare function classifyMongoError(err: unknown): {
    reason: MongoFailureReason;
    code?: string;
};
export declare function connectMongo(): Promise<typeof mongoose>;
export declare function disconnectMongo(): Promise<void>;
export declare function getMongoConnection(): typeof mongoose;
export declare function getConnectionState(): {
    readyState: number;
    label: string;
    connected: boolean;
};
export declare function isConnected(): boolean;
//# sourceMappingURL=connection.d.ts.map