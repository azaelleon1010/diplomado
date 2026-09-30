/**
 * TramaTech ERP — domain types (mobile, Fase 2).
 * Mock-only in this phase. Shapes are designed to match future API DTOs.
 */

export type StockState = 'available' | 'low' | 'out';

export type Priority = 'high' | 'medium' | 'low';

export type OrderStatus = 'in_process' | 'queued' | 'completed' | 'paused';

export type AlertCategory =
  | 'inventory'
  | 'production'
  | 'maintenance'
  | 'purchasing'
  | 'system';

export interface Metric {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  accent: 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
}

export interface RecentOrder {
  id: string;
  title: string;
  module: 'production' | 'maintenance' | 'inventory';
  detail: string;
  statusLabel: string;
  statusTone: 'info' | 'warning' | 'danger' | 'success';
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  time: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  unit: string;
  warehouse: string;
  state: StockState;
}

export interface MaintenanceIssue {
  id: string;
  equipment: string;
  description: string;
  priority: Priority;
  status: 'open' | 'scheduled' | 'in_progress';
  scheduledFor?: string;
}

export interface ProductionOrder {
  id: string;
  product: string;
  progress: number;
  status: OrderStatus;
  machine: string;
  owner: string;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  items: string;
  total: string;
  status: 'pending' | 'approved' | 'received';
  eta: string;
}

export interface HrSummary {
  vacationsAvailable: number;
  currentShift: string;
  attendanceRate: string;
  openIncidents: number;
}

export interface FinanceSummary {
  payable: string;
  receivable: string;
  balance: string;
  recentMovements: Array<{
    id: string;
    label: string;
    amount: string;
    tone: 'success' | 'danger' | 'info';
    date: string;
  }>;
}

export interface AlertItem {
  id: string;
  category: AlertCategory;
  title: string;
  detail: string;
  time: string;
  read: boolean;
  tone: 'warning' | 'danger' | 'info' | 'success';
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  time: string;
  actions?: ReadonlyArray<'confirm' | 'cancel'>;
}
