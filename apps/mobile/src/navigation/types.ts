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
  ProductForm: { productId: string } | undefined;
  Maintenance: undefined;
  AssetForm: undefined;
  MaintenanceOrderForm: undefined;
  MaintenanceOrderDetail: { orderId: string };
  Production: undefined;
  ProductionOrderForm: undefined;
  Purchasing: undefined;
  SupplierForm: undefined;
  PurchaseOrderForm: undefined;
  PurchaseOrderDetail: { orderId: string };
  HR: undefined;
  EmployeeForm: { employeeId: string } | undefined;
  TimeOffForm: undefined;
  TimeOffDetail: { timeOffId: string };
  Finance: undefined;
  FinanceMovementForm: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Settings: undefined;
  About: undefined;
};
