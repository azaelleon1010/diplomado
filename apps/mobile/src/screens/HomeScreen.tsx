import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { useAuth } from '../auth/AuthContext';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { unreadAlertsCount } from '../data/alerts';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';

export function HomeScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title={`Inicio, ${userName.split(' ')[0]}`}
        subtitle="Tu espacio de trabajo"
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>Dashboard</Text>
          <Text style={[styles.detail, { color: palette.textSecondary }]}>
            El dashboard y sus indicadores se habilitarán en la siguiente fase.
          </Text>
          <Button label="Explorar módulos" onPress={() => navigation.navigate('Operations')} />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 480, gap: spacing.md },
  title: { fontSize: typography.h2.fontSize, fontWeight: '600' },
  detail: { fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, marginBottom: spacing.sm },
});
