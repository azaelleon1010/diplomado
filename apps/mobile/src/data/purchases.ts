import type { PurchaseOrder } from '../types';

/** Mock-only. Will be replaced by API DTOs in a later phase. */
export const purchaseOrders: PurchaseOrder[] = [
  {
    id: 'c-301',
    supplier: 'Textiles del Norte',
    items: 'Tela sintética · 200 rollos',
    total: '$184,000',
    status: 'pending',
    eta: 'Recibe en 3 días',
  },
  {
    id: 'c-300',
    supplier: 'Aceros Industriales MX',
    items: 'Acero industrial · 40 planchas',
    total: '$96,500',
    status: 'approved',
    eta: 'Recibe mañana',
  },
  {
    id: 'c-299',
    supplier: 'Refacciones León',
    items: 'Rodamientos · 120 pzas',
    total: '$38,200',
    status: 'received',
    eta: 'Recibido ayer',
  },
];
