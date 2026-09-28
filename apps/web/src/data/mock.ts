/**
 * MOCK DATA
 *
 * All data in this file is explicitly mock/sample data for development.
 * It must NOT be presented as real data from MongoDB or any production source.
 * This layer will be replaced by actual API calls when modules are implemented.
 */

export interface MockKPI {
  label: string;
  value: string;
  subtitle: string;
}

export const mockProductionKPIs: MockKPI[] = [
  { label: 'Producción del día', value: '92.4%', subtitle: 'vs plan semanal' },
  { label: 'Órdenes activas', value: '18', subtitle: 'en proceso' },
  { label: 'Máquinas operativas', value: '47 / 52', subtitle: 'disponibilidad' },
  { label: 'Paros de producción', value: '3', subtitle: 'esta semana' },
  { label: 'Inventario crítico', value: '8', subtitle: 'materiales bajos' },
  { label: 'Almacén ocupado', value: '82%', subtitle: 'capacidad' },
];

export interface MockRecentOrder {
  id: string;
  product: string;
  status: string;
  quantity: string;
}

export const mockRecentOrders: MockRecentOrder[] = [
  { id: 'OT-104', product: 'Tela sintética TS-204', status: 'In process', quantity: '50 rollos' },
  { id: 'OT-103', product: 'Cordón técnico CT-088', status: 'Complete', quantity: '200 m' },
  { id: 'OT-102', product: 'Tejido reforzado RF-012', status: 'Queued', quantity: '75 m²' },
];

export interface MockMaintenanceItem {
  machine: string;
  status: string;
  priority: string;
}

export const mockMaintenance: MockMaintenanceItem[] = [
  { machine: 'Hiladora H-04', status: 'En reparación', priority: 'Alta' },
  { machine: 'Telar T-12', status: 'Mantenimiento', priority: 'Media' },
];
