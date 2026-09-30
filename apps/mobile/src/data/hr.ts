import type { HrSummary } from '../types';

/** Mock-only. Will be replaced by API DTOs in a later phase. */
export const hrSummary: HrSummary = {
  vacationsAvailable: 12,
  currentShift: '06:00 – 14:00',
  attendanceRate: '96%',
  openIncidents: 2,
};

export const hrTeam = [
  { id: 'h-1', name: 'Juan Pérez', detail: 'Operador · Turno matutino · Presente', present: true },
  { id: 'h-2', name: 'María García', detail: 'Calidad · Turno matutino · Presente', present: true },
  { id: 'h-3', name: 'Carlos Ruiz', detail: 'Mantenimiento · Turno matutino · En servicio', present: true },
  { id: 'h-4', name: 'Ana Torres', detail: 'Almacén · Vacaciones hasta viernes', present: false },
];
