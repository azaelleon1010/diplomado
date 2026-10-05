import React, { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { MetricCard } from '../components/MetricCard';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { unreadAlertsCount } from '../data/alerts';
import {
  friendlyMessage,
  hrApi,
  loadSession,
  type Department,
  type Employee,
  type TimeOff,
} from '../lib/api';

const TIMEOFF_META: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pendiente', tone: 'warning' },
  APPROVED: { label: 'Aprobada', tone: 'success' },
  REJECTED: { label: 'Rechazada', tone: 'danger' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

const TIMEOFF_TYPE_LABEL: Record<string, string> = {
  VACATION: 'Vacaciones',
  SICK: 'Incapacidad',
  PERMISSION: 'Permiso',
};

const TIMEOFF_FILTERS = [
  { id: 'PENDING', label: 'Pendientes' },
  { id: 'APPROVED', label: 'Aprobadas' },
  { id: 'all', label: 'Todas' },
] as const;

type TimeOffFilter = (typeof TIMEOFF_FILTERS)[number]['id'];

export function HRScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentNames, setDepartmentNames] = useState<Record<string, string>>({});
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});
  const [timeOffFilter, setTimeOffFilter] = useState<TimeOffFilter>('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await loadSession();
      if (!session?.accessToken) {
        setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
        setEmployees([]);
        setTimeOffs([]);
        return;
      }
      const [fetchedEmployees, fetchedDepartments, fetchedTimeOff] = await Promise.all([
        hrApi.listEmployees(session.accessToken, { limit: 100 }),
        hrApi.listDepartments(session.accessToken).catch(() => [] as Department[]),
        hrApi.listTimeOff(session.accessToken, {
          status: timeOffFilter === 'all' ? undefined : timeOffFilter,
          limit: 100,
        }),
      ]);
      const empList = Array.isArray(fetchedEmployees) ? fetchedEmployees : [];
      setEmployees(empList);
      const depList = Array.isArray(fetchedDepartments) ? fetchedDepartments : [];
      setDepartments(depList);
      const depNames: Record<string, string> = {};
      for (const department of depList) depNames[department._id] = department.name;
      setDepartmentNames(depNames);
      const empNames: Record<string, string> = {};
      for (const employee of empList) empNames[employee._id] = `${employee.firstName} ${employee.lastName}`;
      setEmployeeNames(empNames);
      setTimeOffs(Array.isArray(fetchedTimeOff) ? fetchedTimeOff : []);
    } catch (err) {
      setEmployees([]);
      setTimeOffs([]);
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [timeOffFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const activeCount = employees.filter((e) => e.status === 'ACTIVE').length;
  const pendingCount = timeOffs.filter((t) => t.status === 'PENDING').length;

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Recursos Humanos"
        subtitle="Personal y vacaciones"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.metrics}>
          <MetricCard
            metric={{ id: 'hr-emp', label: 'Empleados activos', value: String(activeCount), subtitle: `${employees.length} registrados`, accent: 'brand' }}
          />
          <MetricCard
            metric={{ id: 'hr-dep', label: 'Departamentos', value: String(departments.length), subtitle: 'Áreas', accent: 'accent' }}
          />
          <MetricCard
            metric={{ id: 'hr-pending', label: 'Solicitudes pendientes', value: String(pendingCount), subtitle: 'Por decidir', accent: 'warning' }}
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: palette.brand }]}
            onPress={() => navigation.navigate('EmployeeForm')}
            accessibilityRole="button"
            accessibilityLabel="Nuevo empleado">
            <Text style={styles.actionText}>+ Empleado</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: palette.surfaceSecondary, borderColor: palette.borderStrong, borderWidth: 1 }]}
            onPress={() => navigation.navigate('TimeOffForm')}
            accessibilityRole="button"
            accessibilityLabel="Nueva solicitud de ausencia">
            <Text style={[styles.actionText, { color: palette.textPrimary }]}>+ Ausencia</Text>
          </TouchableOpacity>
        </View>

        {loading && employees.length === 0 ? (
          <LoadingState label="Cargando personal…" />
        ) : error && employees.length === 0 ? (
          <ErrorState title="No se pudo cargar personal" detail={error} onRetry={() => void loadData()} />
        ) : (
          <>
            <SectionHeader title={`Equipo (${employees.length})`} />
            <Card style={styles.listCard}>
              {employees.length === 0 ? (
                <EmptyState title="Sin empleados" detail="Registra al primer empleado de tu empresa." />
              ) : (
                employees.slice(0, 8).map((employee) => (
                  <ListItem
                    key={employee._id}
                    title={`${employee.firstName} ${employee.lastName}`}
                    subtitle={`${employee.code}${employee.departmentId && departmentNames[employee.departmentId] ? ` · ${departmentNames[employee.departmentId]}` : ''}${employee.position ? ` · ${employee.position}` : ''}`}
                    avatarName={`${employee.firstName} ${employee.lastName}`}
                    badgeLabel={employee.status === 'ACTIVE' ? 'Activo' : employee.status === 'ON_LEAVE' ? 'Ausente' : 'Inactivo'}
                    badgeTone={employee.status === 'ACTIVE' ? 'success' : employee.status === 'ON_LEAVE' ? 'warning' : 'neutral'}
                    showChevron
                    onPress={() => navigation.navigate('EmployeeForm', { employeeId: employee._id })}
                  />
                ))
              )}
            </Card>

            <FlatList
              data={[...TIMEOFF_FILTERS]}
              horizontal
              keyExtractor={(f) => f.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item }) => (
                <Chip label={item.label} selected={timeOffFilter === item.id} onPress={() => setTimeOffFilter(item.id)} />
              )}
            />
            <SectionHeader title={`Ausencias (${timeOffs.length})`} />
            <Card style={styles.listCard}>
              {timeOffs.length === 0 ? (
                <EmptyState title="Sin solicitudes" detail="No hay solicitudes en este estado." />
              ) : (
                timeOffs.map((item) => {
                  const meta = TIMEOFF_META[item.status] ?? { label: item.status, tone: 'neutral' as BadgeTone };
                  return (
                    <ListItem
                      key={item._id}
                      title={`${TIMEOFF_TYPE_LABEL[item.type] ?? item.type} · ${employeeNames[item.employeeId] ?? 'Empleado'}`}
                      subtitle={`${item.startDate} → ${item.endDate}${item.reason ? ` · ${item.reason}` : ''}`}
                      icon="hr"
                      badgeLabel={meta.label}
                      badgeTone={meta.tone}
                      showChevron={item.status === 'PENDING'}
                      onPress={
                        item.status === 'PENDING'
                          ? () => navigation.navigate('TimeOffDetail', { timeOffId: item._id })
                          : undefined
                      }
                    />
                  );
                })
              )}
            </Card>
          </>
        )}
      </ScrollView>
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
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
