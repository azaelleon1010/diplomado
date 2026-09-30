import type { InventoryItem } from '../types';

/** Mock-only. Will be replaced by API DTOs in a later phase. */
export const inventoryItems: InventoryItem[] = [
  { id: 'i-1', name: 'Tela sintética', sku: 'TS-204', stock: 120, unit: 'rollos', warehouse: 'Almacén B', state: 'low' },
  { id: 'i-2', name: 'Acero industrial', sku: 'AC-110', stock: 18, unit: 'planchas', warehouse: 'Almacén A', state: 'low' },
  { id: 'i-3', name: 'Rodamientos', sku: 'RD-042', stock: 0, unit: 'pzas', warehouse: 'Almacén C', state: 'out' },
  { id: 'i-4', name: 'Hilo técnico', sku: 'HT-330', stock: 540, unit: 'bobinas', warehouse: 'Almacén B', state: 'available' },
  { id: 'i-5', name: 'Resina epóxica', sku: 'RX-018', stock: 64, unit: 'cubetas', warehouse: 'Almacén A', state: 'available' },
  { id: 'i-6', name: 'Bandas transportadoras', sku: 'BT-207', stock: 7, unit: 'pzas', warehouse: 'Almacén C', state: 'low' },
  { id: 'i-7', name: 'Sensores ópticos', sku: 'SO-091', stock: 32, unit: 'pzas', warehouse: 'Almacén A', state: 'available' },
];

export const warehouses = ['Todos', 'Almacén A', 'Almacén B', 'Almacén C'] as const;
