import type { AlertCategory, AlertItem } from '../types';

/** Mock-only. Will be replaced by API DTOs in a later phase. */
export const alertCategories: ReadonlyArray<{ id: AlertCategory | 'all'; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'production', label: 'Producción' },
  { id: 'maintenance', label: 'Mantenimiento' },
  { id: 'purchasing', label: 'Compras' },
  { id: 'system', label: 'Sistema' },
];

const BASE_ALERTS: AlertItem[] = [
  {
    id: 'al-1',
    category: 'maintenance',
    title: 'Falla en Hiladora 4',
    detail: 'Banda rota · Prioridad alta · Línea detenida',
    time: 'hace 40 min',
    read: false,
    tone: 'danger',
  },
  {
    id: 'al-2',
    category: 'inventory',
    title: 'Rodamientos agotados',
    detail: 'Stock 0 · Almacén C · Solicitar compra',
    time: 'hace 1 h',
    read: false,
    tone: 'warning',
  },
  {
    id: 'al-3',
    category: 'production',
    title: 'Orden #104 al 68%',
    detail: 'Componente textil · Ritmo normal',
    time: 'hace 2 h',
    read: false,
    tone: 'info',
  },
  {
    id: 'al-4',
    category: 'purchasing',
    title: 'OC-301 pendiente de aprobación',
    detail: 'Textiles del Norte · $184,000',
    time: 'hace 3 h',
    read: true,
    tone: 'info',
  },
  {
    id: 'al-5',
    category: 'system',
    title: 'Respaldo completado',
    detail: 'Respaldo nocturno sin errores',
    time: 'hace 6 h',
    read: true,
    tone: 'success',
  },
];

/** Local mutable copy so "marcar como leída" works in this mock phase. */
export let alertsStore: AlertItem[] = BASE_ALERTS.map((a) => ({ ...a }));

export function resetAlertsStore(): void {
  alertsStore = BASE_ALERTS.map((a) => ({ ...a }));
}

export function markAlertRead(id: string): void {
  alertsStore = alertsStore.map((a) => (a.id === id ? { ...a, read: true } : a));
}

export function markAllAlertsRead(): void {
  alertsStore = alertsStore.map((a) => ({ ...a, read: true }));
}

export function unreadAlertsCount(): number {
  return alertsStore.filter((a) => !a.read).length;
}
