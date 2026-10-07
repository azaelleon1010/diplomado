import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { useTheme } from '../theme/Theme';
import { Icon, type IconName } from '../components/Icon';
import { HomeScreen } from '../screens/HomeScreen';
import { AssistantScreen } from '../screens/AssistantScreen';
import { OperationsStack } from './OperationsStack';
import { AlertsScreen } from '../screens/AlertsScreen';
import { MoreStack } from './MoreStack';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, IconName> = {
  Home: 'home',
  Assistant: 'assistant',
  Operations: 'operations',
  Alerts: 'alerts',
  More: 'more',
};

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Home: 'Inicio',
  Assistant: 'Asistente',
  Operations: 'Operaciones',
  Alerts: 'Alertas',
  More: 'Más',
};

export function MainTabs(): React.JSX.Element {
  const { palette } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.backgroundSecondary,
          borderTopColor: palette.borderStrong,
          borderTopWidth: 1,
          minHeight: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => (
          <Icon name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: TAB_LABELS.Home }} />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{ tabBarLabel: TAB_LABELS.Assistant }}
      />
      <Tab.Screen
        name="Operations"
        component={OperationsStack}
        options={{ tabBarLabel: TAB_LABELS.Operations }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ tabBarLabel: TAB_LABELS.Alerts }}
      />
      <Tab.Screen name="More" component={MoreStack} options={{ tabBarLabel: TAB_LABELS.More }} />
    </Tab.Navigator>
  );
}
