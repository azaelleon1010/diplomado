import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OperationsStackParamList } from './types';
import { OperationsHubScreen } from '../screens/OperationsHubScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { ProductFormScreen } from '../screens/ProductFormScreen';
import { StockScreen } from '../screens/StockScreen';
import { StockMovementFormScreen } from '../screens/StockMovementFormScreen';
import { MaintenanceScreen } from '../screens/MaintenanceScreen';
import { AssetFormScreen } from '../screens/AssetFormScreen';
import { MaintenanceOrderFormScreen } from '../screens/MaintenanceOrderFormScreen';
import { MaintenanceOrderDetailScreen } from '../screens/MaintenanceOrderDetailScreen';
import { ProductionScreen } from '../screens/ProductionScreen';
import { ProductionOrderFormScreen } from '../screens/ProductionOrderFormScreen';
import { PurchasingScreen } from '../screens/PurchasingScreen';
import { SupplierFormScreen } from '../screens/SupplierFormScreen';
import { PurchaseOrderFormScreen } from '../screens/PurchaseOrderFormScreen';
import { PurchaseOrderDetailScreen } from '../screens/PurchaseOrderDetailScreen';
import { PurchaseReceiveScreen } from '../screens/PurchaseReceiveScreen';
import { HRScreen } from '../screens/HRScreen';
import { EmployeeFormScreen } from '../screens/EmployeeFormScreen';
import { TimeOffFormScreen } from '../screens/TimeOffFormScreen';
import { TimeOffDetailScreen } from '../screens/TimeOffDetailScreen';
import { FinanceScreen } from '../screens/FinanceScreen';
import { FinanceMovementFormScreen } from '../screens/FinanceMovementFormScreen';
import { MODULE_ACCESS } from './moduleAccess';
import { withModulePermission } from './withModulePermission';

const Stack = createNativeStackNavigator<OperationsStackParamList>();
const InventoryScreenAccess = withModulePermission(InventoryScreen, MODULE_ACCESS.inventoryRead);
const ProductFormScreenAccess = withModulePermission(ProductFormScreen, MODULE_ACCESS.inventoryWrite);
const StockScreenAccess = withModulePermission(StockScreen, MODULE_ACCESS.inventoryRead);
const StockMovementFormScreenAccess = withModulePermission(StockMovementFormScreen, MODULE_ACCESS.inventoryMove);
const MaintenanceScreenAccess = withModulePermission(MaintenanceScreen, MODULE_ACCESS.maintenanceRead);
const AssetFormScreenAccess = withModulePermission(AssetFormScreen, MODULE_ACCESS.maintenanceWrite);
const MaintenanceOrderFormScreenAccess = withModulePermission(MaintenanceOrderFormScreen, MODULE_ACCESS.maintenanceWrite);
const MaintenanceOrderDetailScreenAccess = withModulePermission(MaintenanceOrderDetailScreen, MODULE_ACCESS.maintenanceRead);
const ProductionScreenAccess = withModulePermission(ProductionScreen, MODULE_ACCESS.productionRead);
const ProductionOrderFormScreenAccess = withModulePermission(ProductionOrderFormScreen, MODULE_ACCESS.productionWrite);
const PurchasingScreenAccess = withModulePermission(PurchasingScreen, MODULE_ACCESS.purchasingRead);
const SupplierFormScreenAccess = withModulePermission(SupplierFormScreen, MODULE_ACCESS.purchasingWrite);
const PurchaseOrderFormScreenAccess = withModulePermission(PurchaseOrderFormScreen, MODULE_ACCESS.purchasingWrite);
const PurchaseOrderDetailScreenAccess = withModulePermission(PurchaseOrderDetailScreen, MODULE_ACCESS.purchasingRead);
const PurchaseReceiveScreenAccess = withModulePermission(PurchaseReceiveScreen, MODULE_ACCESS.purchasingReceive);
const HRScreenAccess = withModulePermission(HRScreen, MODULE_ACCESS.hrRead);
const EmployeeFormScreenAccess = withModulePermission(EmployeeFormScreen, MODULE_ACCESS.hrWrite);
const TimeOffFormScreenAccess = withModulePermission(TimeOffFormScreen, MODULE_ACCESS.hrWrite);
const TimeOffDetailScreenAccess = withModulePermission(TimeOffDetailScreen, MODULE_ACCESS.hrTimeOffRead);
const FinanceScreenAccess = withModulePermission(FinanceScreen, MODULE_ACCESS.financeRead);
const FinanceMovementFormScreenAccess = withModulePermission(FinanceMovementFormScreen, MODULE_ACCESS.financeWrite);

export function OperationsStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OperationsHub" component={OperationsHubScreen} />
      <Stack.Screen name="Inventory" component={InventoryScreenAccess} />
      <Stack.Screen name="ProductForm" component={ProductFormScreenAccess} />
      <Stack.Screen name="Stock" component={StockScreenAccess} />
      <Stack.Screen name="StockMovementForm" component={StockMovementFormScreenAccess} />
      <Stack.Screen name="Maintenance" component={MaintenanceScreenAccess} />
      <Stack.Screen name="AssetForm" component={AssetFormScreenAccess} />
      <Stack.Screen name="MaintenanceOrderForm" component={MaintenanceOrderFormScreenAccess} />
      <Stack.Screen name="MaintenanceOrderDetail" component={MaintenanceOrderDetailScreenAccess} />
      <Stack.Screen name="Production" component={ProductionScreenAccess} />
      <Stack.Screen name="ProductionOrderForm" component={ProductionOrderFormScreenAccess} />
      <Stack.Screen name="Purchasing" component={PurchasingScreenAccess} />
      <Stack.Screen name="SupplierForm" component={SupplierFormScreenAccess} />
      <Stack.Screen name="PurchaseOrderForm" component={PurchaseOrderFormScreenAccess} />
      <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreenAccess} />
      <Stack.Screen name="PurchaseReceive" component={PurchaseReceiveScreenAccess} />
      <Stack.Screen name="HR" component={HRScreenAccess} />
      <Stack.Screen name="EmployeeForm" component={EmployeeFormScreenAccess} />
      <Stack.Screen name="TimeOffForm" component={TimeOffFormScreenAccess} />
      <Stack.Screen name="TimeOffDetail" component={TimeOffDetailScreenAccess} />
      <Stack.Screen name="Finance" component={FinanceScreenAccess} />
      <Stack.Screen name="FinanceMovementForm" component={FinanceMovementFormScreenAccess} />
    </Stack.Navigator>
  );
}
