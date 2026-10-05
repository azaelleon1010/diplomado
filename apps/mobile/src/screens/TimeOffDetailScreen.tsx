import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ListItem } from '../components/ListItem';
import { ErrorState, LoadingState } from '../components/States';
import { pushAlert, unreadAlertsCount } from '../data/alerts';
import {
  friendlyMessage,
  hrApi,
  loadSession,
  type Employee,
  type TimeOff,
} from '../lib/api';
import type { OperationsStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<OperationsStackParamList, 'TimeOffDetail'>;

const TYPE_LABEL: Record<string, string> = {
  VACATION: 'Vacaciones',
  SICK: 'Incapacidad',
  PERMISSION: 'Permiso',
};

export function TimeOffDetailScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const route = useRoute<DetailRoute>();
  const [request, setRequest] = useState<TimeOff | null>(null);
  const [employeeName, setEmployeeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await loadSession();
      if (!session?.accessToken) {
        setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const [list, employees] = await Promise.all([
        hrApi.listTimeOff(session.accessToken, { limit: 100 }),
        hrApi.listEmployees(session.accessToken, { limit: 100 }).catch(() => [] as Employee[]),
      ]);
      const found = (Array.isArray(list) ? list : []).find((t) => t._id === route.params.timeOffId) ?? null;
      if (!found) {
        setError('La solicitud ya no está disponible.');
        setRequest(null);
        return;
      }
      setRequest(found);
      const employee = (Array.isArray(employees) ? employees : []).find((e) => e._id === found.employeeId);
      setEmployeeName(employee ? `${employee.firstName} ${employee.lastName}` : found.employeeId);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [route.params.timeOffId]);

  useFocusEffect(
    useCallback(() => {
      void loadRequest();
    }, [loadRequest]),
  );

  async function decide(to: 'APPROVED' | 'REJECTED'): Promise<void> {
    if (!request) return;
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setActing(true);
    try {
      const updated = await hrApi.decideTimeOff(session.accessToken, request._id, to, request.version);
      setRequest(updated);
      pushAlert(
        'system',
        to === 'APPROVED' ? 'Ausencia aprobada' : 'Ausencia rechazada',
        `${employeeName} · ${updated.startDate} → ${updated.endDate}`,
        to === 'APPROVED' ? 'success' : 'info',
      );
    } catch (err) {
      Alert.alert('Error', friendlyMessage(err));
    } finally {
      setActing(false);
    }
  }

  function confirmDecide(to: 'APPROVED' | 'REJECTED'): void {
    Alert.alert(
      to === 'APPROVED' ? 'Aprobar solicitud' : 'Rechazar solicitud',
      'La decisión quedará registrada en auditoría.',
      [
        { text: 'Volver', style: 'cancel' },
        { text: 'Confirmar', onPress: () => void decide(to) },
      ],
    );
  }

  const tone: BadgeTone =
    request?.status === 'APPROVED' ? 'success' : request?.status === 'REJECTED' ? 'danger' : request?.status === 'CANCELLED' ? 'neutral' : 'warning';

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Solicitud de ausencia"
        subtitle={request ? (TYPE_LABEL[request.type] ?? request.type) : undefined}
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      {loading ? (
        <LoadingState label="Cargando solicitud…" />
      ) : error || !request ? (
        <ErrorState title="Solicitud no disponible" detail={error ?? undefined} onRetry={() => void loadRequest()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>{employeeName}</Text>
              <StatusBadge label={request.status === 'PENDING' ? 'Pendiente' : request.status === 'APPROVED' ? 'Aprobada' : request.status === 'REJECTED' ? 'Rechazada' : 'Cancelada'} tone={tone} />
            </View>
            <Text style={[styles.detail, { color: palette.textSecondary }]}>
              {TYPE_LABEL[request.type] ?? request.type} · {request.startDate} → {request.endDate}
            </Text>
            {request.reason ? (
              <Text style={[styles.detail, { color: palette.textSecondary }]}>{request.reason}</Text>
            ) : null}
          </Card>

          {request.status === 'PENDING' ? (
            <>
              <SectionHeader title="Decisión" />
              <View style={styles.actions}>
                <Button
                  label="Aprobar"
                  onPress={() => confirmDecide('APPROVED')}
                  loading={acting}
                  disabled={acting}
                />
                <Button
                  label="Rechazar"
                  variant="danger"
                  onPress={() => confirmDecide('REJECTED')}
                  loading={acting}
                  disabled={acting}
                />
              </View>
            </>
          ) : (
            <Card style={styles.listCard}>
              <ListItem
                title="Decidida por"
                subtitle={`${request.decidedBy ?? '—'}${request.decidedAt ? ` · ${request.decidedAt}` : ''}`}
                icon="hr"
              />
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    flex: 1,
  },
  detail: {
    fontSize: typography.body.fontSize,
    marginTop: spacing.sm,
  },
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
});
