import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { unreadAlertsCount } from '../data/alerts';
import { getVisibleModulesForSection } from '../navigation/moduleAccess';
import { EmptyState } from '../components/States';

export function OperationsHubScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName, me } = useAuth();
  const navigation = useAppNavigation();
  const modules = getVisibleModulesForSection(me?.permissions ?? [], 'Operaciones');

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Operaciones"
        subtitle="Módulos de planta"
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.listCard}>
          {modules.map((m) => (
            <ListItem
              key={m.key}
              title={m.title}
              subtitle={m.detail}
              icon={m.icon}
              showChevron
              onPress={() => navigation.navigate('Operations', { screen: m.route } as never)}
            />
          ))}
          {modules.length === 0 ? (
            <EmptyState title="Sin módulos disponibles" detail="Tu sesión no tiene permisos para ver módulos operativos." />
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
