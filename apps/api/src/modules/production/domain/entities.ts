/**
 * Production domain entities — pure TypeScript.
 * No Express, no Mongoose, no JWT, no bcrypt allowed in this layer.
 *
 * Products and materials always reference the inventory catalog
 * (never a duplicated catalog).
 */

export type ProductionOrderStatus =
  | 'DRAFT'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ProductionMaterial {
  productId: string;
  quantityRequired: number;
  quantityConsumed: number;
}

export interface ProductionOrder {
  _id: string;
  tenantId: string;
  code: string;
  productId: string;
  quantity: number;
  producedQuantity: number;
  status: ProductionOrderStatus;
  machine?: string;
  responsible?: string;
  dueDate?: string;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
  materials: ProductionMaterial[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export const PRODUCTION_ACTIONS = {
  ORDER_CREATED: 'production.order.created',
  ORDER_UPDATED: 'production.order.updated',
  ORDER_RELEASED: 'production.order.released',
  ORDER_STARTED: 'production.order.started',
  ORDER_PAUSED: 'production.order.paused',
  ORDER_COMPLETED: 'production.order.completed',
  ORDER_CANCELLED: 'production.order.cancelled',
} as const;
