import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OperationsStackParamList } from './types';
import { OperationsHubScreen } from '../screens/OperationsHubScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { ProductFormScreen } from '../screens/ProductFormScreen';
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
import { HRScreen } from '../screens/HRScreen';
import { EmployeeFormScreen } from '../screens/EmployeeFormScreen';
import { TimeOffFormScreen } from '../screens/TimeOffFormScreen';
import { TimeOffDetailScreen } from '../screens/TimeOffDetailScreen';
import { FinanceScreen } from '../screens/FinanceScreen';
import { FinanceMovementFormScreen } from '../screens/FinanceMovementFormScreen';

const Stack = createNativeStackNavigator<OperationsStackParamList>();

export function OperationsStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OperationsHub" component={OperationsHubScreen} />
      <Stack.Screen name="Inventory" component={InventoryScreen} />
      <Stack.Screen
        name="ProductForm"
        component={ProductFormScreen}
      />
      <Stack.Screen name="Maintenance" component={MaintenanceScreen} />
  <Stack.Screen name="AssetForm" component={AssetFormScreen} />
  <Stack.Screen name="MaintenanceOrderForm" component={MaintenanceOrderFormScreen} />
  <Stack.Screen name="MaintenanceOrderDetail" component={MaintenanceOrderDetailScreen} />
      <Stack.Screen name="Production" component={ProductionScreen} />
  <Stack.Screen name="ProductionOrderForm" component={ProductionOrderFormScreen} />
      <Stack.Screen name="Purchasing" component={PurchasingScreen} />
  <Stack.Screen name="SupplierForm" component={SupplierFormScreen} />
  <Stack.Screen name="PurchaseOrderForm" component={PurchaseOrderFormScreen} />
  <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />
      <Stack.Screen name="HR" component={HRScreen} />
      <Stack.Screen name="EmployeeForm" component={EmployeeFormScreen} />
      <Stack.Screen name="TimeOffForm" component={TimeOffFormScreen} />
      <Stack.Screen name="TimeOffDetail" component={TimeOffDetailScreen} />
      <Stack.Screen name="Finance" component={FinanceScreen} />
  <Stack.Screen name="FinanceMovementForm" component={FinanceMovementFormScreen} />
    </Stack.Navigator>
  );
}
