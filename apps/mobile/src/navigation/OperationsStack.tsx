import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OperationsStackParamList } from './types';
import { OperationsHubScreen } from '../screens/OperationsHubScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { MaintenanceScreen } from '../screens/MaintenanceScreen';
import { ProductionScreen } from '../screens/ProductionScreen';
import { PurchasingScreen } from '../screens/PurchasingScreen';
import { HRScreen } from '../screens/HRScreen';
import { FinanceScreen } from '../screens/FinanceScreen';

const Stack = createNativeStackNavigator<OperationsStackParamList>();

export function OperationsStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OperationsHub" component={OperationsHubScreen} />
      <Stack.Screen name="Inventory" component={InventoryScreen} />
      <Stack.Screen name="Maintenance" component={MaintenanceScreen} />
      <Stack.Screen name="Production" component={ProductionScreen} />
      <Stack.Screen name="Purchasing" component={PurchasingScreen} />
      <Stack.Screen name="HR" component={HRScreen} />
      <Stack.Screen name="Finance" component={FinanceScreen} />
    </Stack.Navigator>
  );
}
