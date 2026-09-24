/**
 * Legacy path — delegates to @erp/database (single pool).
 * Kept for backwards compat; new code should import from @erp/database
 * or apps/api/src/infrastructure/database/mongodb
 */
export { connectMongo, disconnectMongo, getMongoConnection, getConnectionState, isConnected } from '@erp/database';
export { pingMongo, getMongoStatus } from '@erp/database';
