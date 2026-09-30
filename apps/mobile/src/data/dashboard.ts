import type { ActivityItem, Metric, RecentOrder } from '../types';

/** Mock-only. Will be replaced by API DTOs in a later phase. */
export const dashboardMetrics: Metric[] = [
  { id: 'm-orders', label: 'Órdenes activas', value: '18', subtitle: '6 en proceso', accent: 'brand' },
  { id: 'm-prod', label: 'Producción del día', value: '72%', subtitle: 'Meta: 85%', accent: 'accent' },
  { id: 'm-stock', label: 'Inventario bajo', value: '9', subtitle: '3 agotados', accent: 'warning' },
  { id: 'm-incidents', label: 'Incidencias abiertas', value: '4', subtitle: '1 prioridad alta', accent: 'danger' },
];

export const recentOrders: RecentOrder[] = [
  {
    id: 'o-104',
    title: 'Orden #104',
    module: 'production',
    detail: 'Componente textil · En proceso · 68%',
    statusLabel: 'En proceso',
    statusTone: 'info',
  },
  {
    id: 'o-m4',
    title: 'Máquina #4',
    module: 'maintenance',
    detail: 'Hiladora 4 · Banda rota',
    statusLabel: 'Falla reportada',
    statusTone: 'danger',
  },
  {
    id: 'o-ts',
    title: 'Tela sintética',
    module: 'inventory',
    detail: 'Almacén B · 120 rollos',
    statusLabel: 'Stock bajo',
    statusTone: 'warning',
  },
];

export const recentActivity: ActivityItem[] = [
  {
    id: 'a-1',
    title: 'Movimiento de inventario',
    detail: 'Salida de 50 rollos · Almacén B · Orden #104',
    time: 'hace 12 min',
  },
  {
    id: 'a-2',
    title: 'Incidencia registrada',
    detail: 'Hiladora 4 · Banda rota · Prioridad alta',
    time: 'hace 40 min',
  },
  {
    id: 'a-3',
    title: 'Orden #103 completada',
    detail: 'Componente textil · Turno matutino',
    time: 'hace 2 h',
  },
];

export const systemStatus = {
  label: 'Sistemas operativos',
  detail: 'Planta · Turno matutino 06:00 – 14:00',
};

export const currentUser = {
  name: 'Alejandro León',
  role: 'Supervisor de planta',
  greeting: 'Buen día',
};
