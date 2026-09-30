import type { ProductionOrder } from '../types';

/** Mock-only. Will be replaced by API DTOs in a later phase. */
export const productionOrders: ProductionOrder[] = [
  {
    id: 'p-104',
    product: 'Componente textil TX-40',
    progress: 68,
    status: 'in_process',
    machine: 'Hiladora 4',
    owner: 'Turno matutino',
  },
  {
    id: 'p-105',
    product: 'Refuerzo automotriz RA-12',
    progress: 24,
    status: 'in_process',
    machine: 'Telar 7',
    owner: 'Turno matutino',
  },
  {
    id: 'p-106',
    product: 'Malla técnica MT-08',
    progress: 0,
    status: 'queued',
    machine: 'Por asignar',
    owner: 'Planeación',
  },
  {
    id: 'p-103',
    product: 'Componente textil TX-39',
    progress: 100,
    status: 'completed',
    machine: 'Hiladora 2',
    owner: 'Turno matutino',
  },
  {
    id: 'p-102',
    product: 'Cinta reforzada CR-21',
    progress: 41,
    status: 'paused',
    machine: 'Cortadora 2',
    owner: 'Turno vespertino',
  },
];
