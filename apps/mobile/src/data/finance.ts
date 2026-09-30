import type { FinanceSummary } from '../types';

/** Mock-only. Will be replaced by API DTOs in a later phase. */
export const financeSummary: FinanceSummary = {
  payable: '$412,800',
  receivable: '$638,400',
  balance: '+$225,600',
  recentMovements: [
    { id: 'f-1', label: 'Pago a Textiles del Norte', amount: '-$96,000', tone: 'danger', date: 'Hoy' },
    { id: 'f-2', label: 'Cobro Autopartes del Bajío', amount: '+$210,000', tone: 'success', date: 'Ayer' },
    { id: 'f-3', label: 'Nómina semanal', amount: '-$188,400', tone: 'danger', date: 'Ayer' },
    { id: 'f-4', label: 'Anticipo pedido #104', amount: '+$75,000', tone: 'success', date: 'Lunes' },
  ],
};
