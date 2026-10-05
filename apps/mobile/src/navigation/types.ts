/**
 * Typed navigation param lists (React Navigation v7).
 */
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  ProductionDetail: { orderId: string };
  AlertDetail: { alertId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Assistant: undefined;
  Operations: undefined;
  Alerts: undefined;
  More: undefined;
};

export type OperationsStackParamList = {
  OperationsHub: undefined;
  Inventory: undefined;
  Maintenance: undefined;
  Production: undefined;
  Purchasing: undefined;
  HR: undefined;
  Finance: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Settings: undefined;
  About: undefined;
};
