import React, { useState, useEffect, useCallback } from 'react';
import { AssistantPanel } from '../components/AssistantPanel';
import { ModulePlaceholder } from '../screens/ModulePlaceholder';
import { LoginScreen } from '../screens/Login';
import { RegisterScreen } from '../screens/Register';
import { RouteStateScreen } from '../screens/RouteStateScreen';
import { DashboardScreen } from '../screens/Dashboard';
import { ROUTE_DEFINITIONS, getRouteDefinition, canAccessRoute } from './registry';
import { InventoryScreen } from '../screens/Inventory';
import { StockScreen } from '../screens/Stock';
import { PurchasingScreen } from '../screens/Purchasing';
import { ProductionScreen } from '../screens/Production';
import { MaintenanceScreen } from '../screens/Maintenance';
import { HrScreen } from '../screens/Hr';

export const PUBLIC_ROUTES = ['/login', '/register'];

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
    if (window.location.pathname === target) {
      setPath(target);
      return;
    }
    window.history.pushState({}, '', target);
    setPath(target);
  }, []);

  return { path, navigate };
}

export function renderRoute(
  path: string,
  onNavigate: (target: string) => void,
  permissions: readonly string[] = [],
) {
  if (path === '/login') return <LoginScreen onNavigate={onNavigate} />;
  if (path === '/register') return <RegisterScreen onNavigate={onNavigate} />;
  if (path === '/') return <DashboardScreen />;

  if (!canAccessRoute(path, permissions)) {
    return (
      <RouteStateScreen
        title="Acceso no permitido"
        detail="Tu sesión no tiene un permiso disponible para abrir esta sección."
        actionLabel="Ir al inicio"
        onAction={() => onNavigate('/dashboard')}
      />
    );
  }

  if (path === '/assistant') return <AssistantPanel />;
  if (path === '/dashboard') return <DashboardScreen />;
  // Registry requires inventory.read; the API enforces it again server-side.
  if (path === '/operations/inventory') return <InventoryScreen />;
  if (path === '/operations/warehouses') return <StockScreen />;
  if (path === '/procurement/purchases') return <PurchasingScreen initialTab="orders" />;
  if (path === '/procurement/suppliers') return <PurchasingScreen initialTab="suppliers" />;
  if (path === '/operations/production') return <ProductionScreen />;
  if (path === '/operations/maintenance') return <MaintenanceScreen initialTab="orders" />;
  if (path === '/people/employees') return <HrScreen initialTab="employees" />;
  if (path === '/people/vacations') return <HrScreen initialTab="timeoff" />;

  const exactRoute = ROUTE_DEFINITIONS.find((route) => route.path === path);
  if (exactRoute) return <ModulePlaceholder moduleName={exactRoute.title} />;

  const parentRoute = getRouteDefinition(path);
  if (parentRoute) {
    return (
      <RouteStateScreen
        title="Ruta no encontrada"
        detail="La dirección solicitada no corresponde a una pantalla disponible."
        actionLabel="Ir al inicio"
        onAction={() => onNavigate('/dashboard')}
      />
    );
  }

  return (
    <RouteStateScreen
      title="Ruta no encontrada"
      detail="La dirección solicitada no corresponde a una pantalla disponible."
      actionLabel="Ir al inicio"
      onAction={() => onNavigate('/dashboard')}
    />
  );
}
