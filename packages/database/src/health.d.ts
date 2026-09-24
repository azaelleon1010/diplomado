export type HealthStatus = 'ok' | 'down';
export declare function pingMongo(): Promise<{
    status: HealthStatus;
    latencyMs: number;
    message?: string;
}>;
export declare function getMongoStatus(): {
    status: HealthStatus;
    message?: string;
};
//# sourceMappingURL=health.d.ts.map