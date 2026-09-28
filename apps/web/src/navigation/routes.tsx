import React, { useState, useEffect, useCallback } from 'react';
import { Dashboard } from '../components/Dashboard';
import { AssistantPanel } from '../components/AssistantPanel';
import { ModulePlaceholder } from '../screens/ModulePlaceholder';

const ROUTES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/assistant': 'ConvOps Assistant',
  '/operations/production': 'Producción',
  '/operations/inventory': 'Inventario',
  '/operations/warehouses': 'Almacenes',
  '/operations/maintenance': 'Mantenimiento',
  '/operations/quality': 'Calidad',
  '/procurement/purchases': 'Compras',
  '/procurement/suppliers': 'Proveedores',
  '/sales/customers': 'Clientes',
  '/sales/orders': 'Pedidos',
  '/finance/accounting': 'Contabilidad',
  '/finance/receivables': 'Cuentas por cobrar',
  '/finance/payables': 'Cuentas por pagar',
  '/finance/treasury': 'Tesorería',
  '/people/employees': 'Empleados',
  '/people/attendance': 'Asistencia',
  '/people/vacations': 'Vacaciones',
  '/master-data/products': 'Productos',
  '/master-data/materials': 'Materiales',
  '/master-data/machines': 'Maquinaria',
  '/analytics': 'Analítica',
  '/integrations': 'Integraciones',
  '/administration': 'Administración',
};

export function useNavigation() {
  const [path, setPath] = useState(() => window.location.pathname || '/dashboard');

  useEffect(() => {
    function onPopState() {
      setPath(window.location.pathname || '/dashboard');
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((target: string) => {
    window.history.pushState({}, '', target);
    setPath(target);
  }, []);

  return { path, navigate };
}

export function renderRoute(path: string) {
  if (path === '/dashboard') return <Dashboard currentPath={path} />;
  if (path === '/assistant') return <AssistantPanel />;
  const moduleName = ROUTES[path];
  if (moduleName) return <ModulePlaceholder moduleName={moduleName} />;
  return <ModulePlaceholder moduleName="Inicio" />;
}
