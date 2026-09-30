import React from 'react';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/Theme';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from './types';
import { LoginScreen } from '../screens/LoginScreen';
import { MainTabs } from './MainTabs';
import { ProductionDetailScreen } from '../screens/ProductionDetailScreen';
import { AlertDetailScreen } from '../screens/AlertDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const { palette } = useTheme();
  const { signedIn } = useAuth();

  const navTheme: Theme = {
    ...DefaultTheme,
    dark: true,
    colors: {
      ...DefaultTheme.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.backgroundSecondary,
      text: palette.textPrimary,
      border: palette.borderStrong,
      notification: palette.danger,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {signedIn ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="ProductionDetail" component={ProductionDetailScreen} />
            <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
