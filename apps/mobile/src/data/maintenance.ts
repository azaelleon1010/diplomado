import type { MaintenanceIssue } from '../types';

/** Mock-only. Will be replaced by API DTOs in a later phase. */
export const maintenanceIssues: MaintenanceIssue[] = [
  {
    id: 'mt-1',
    equipment: 'Hiladora 4',
    description: 'Banda rota · paro de línea',
    priority: 'high',
    status: 'open',
  },
  {
    id: 'mt-2',
    equipment: 'Cortadora 2',
    description: 'Mantenimiento preventivo programado',
    priority: 'medium',
    status: 'scheduled',
    scheduledFor: 'Mañana · 08:00',
  },
  {
    id: 'mt-3',
    equipment: 'Compresor C-1',
    description: 'Revisión de filtros en curso',
    priority: 'low',
    status: 'in_progress',
  },
  {
    id: 'mt-4',
    equipment: 'Telar 7',
    description: 'Calibración de tensión pendiente',
    priority: 'medium',
    status: 'open',
  },
];
