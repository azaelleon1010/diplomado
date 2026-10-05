/**
 * Maintenance domain entities — pure TypeScript.
 * No Express, no Mongoose, no JWT, no bcrypt allowed in this layer.
 */

export type AssetStatus = 'ACTIVE' | 'IN_MAINTENANCE' | 'OUT_OF_SERVICE' | 'RETIRED';

export interface Asset {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  type: string;
  location?: string;
  responsible?: string;
  status: AssetStatus;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export type MaintenanceOrderStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MaintenanceOrder {
  _id: string;
  tenantId: string;
  assetId: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  title: string;
  description?: string;
  status: MaintenanceOrderStatus;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  cost: number;
  assignedTo?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export const MAINTENANCE_ACTIONS = {
  ASSET_CREATED: 'maintenance.asset.created',
  ASSET_UPDATED: 'maintenance.asset.updated',
  ASSET_RETIRED: 'maintenance.asset.retired',
  ORDER_CREATED: 'maintenance.order.created',
  ORDER_UPDATED: 'maintenance.order.updated',
  ORDER_STARTED: 'maintenance.order.started',
  ORDER_ON_HOLD: 'maintenance.order.onHold',
  ORDER_COMPLETED: 'maintenance.order.completed',
  ORDER_CANCELLED: 'maintenance.order.cancelled',
} as const;
