/**
 * RRHH (Web): empleados, departamentos y ausencias (vacaciones/incapacidad/permiso).
 *
 * Usa el cliente compartido packages/types/src/hr.ts (nuevo en esta fase).
 * El backend es quien impone permisos y el alcance "self" de ausencias;
 * esta pantalla solo oculta botones que el servidor rechazaría. No incluye
 * asistencia ni nómina: ese backend no existe todavía (ver
 * docs/ERP-CURRENT-STATE.md). Mobile cubre lo mismo con DTOs propios en
 * apps/mobile/src/lib/api.ts; migrarlo al cliente compartido queda para un
 * cambio dedicado.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { useAuth } from '../auth/AuthContext';
import { friendlyMessage, hrApi, loadSession } from '../lib/api';
import { hasPermission } from '../../../../packages/types/src/permissions';
import {
  EMPLOYEE_STATUS,
  TIMEOFF_STATUS,
  TIMEOFF_TYPE,
  describeHrError,
  timeOffActions,
  type Department,
  type Employee,
  type EmployeeStatus,
  type TimeOff,
  type TimeOffStatus,
  type TimeOffType,
  type Tone,
} from '../../../../packages/types/src/hr';

type Tab = 'employees' | 'timeoff';
type Panel = 'none' | 'employee' | 'department' | 'timeoff';

const TIMEOFF_FILTERS: Array<{ id: TimeOffStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'PENDING', label: 'Pendientes' },
  { id: 'APPROVED', label: 'Aprobadas' },
  { id: 'REJECTED', label: 'Rechazadas' },
  { id: 'CANCELLED', label: 'Canceladas' },
];

interface EmployeeForm {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  position: string;
  location: string;
}

const EMPTY_EMPLOYEE_FORM: EmployeeForm = { code: '', firstName: '', lastName: '', email: '', phone: '', departmentId: '', position: '', location: '' };

interface TimeOffForm {
  employeeId: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  reason: string;
}

const EMPTY_TIMEOFF_FORM: TimeOffForm = { employeeId: '', type: 'VACATION', startDate: '', endDate: '', reason: '' };

export function HrScreen({ initialTab = 'employees' }: { initialTab?: Tab }) {
  const t = useTheme();
  const c = t.semanticColors;
  const { permissions } = useAuth();
  const canWrite = hasPermission(permissions, 'hr.write');
  const canWriteSelf = hasPermission(permissions, 'hr.write.self');

  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesTotal, setEmployeesTotal] = useState(0);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'ALL'>('ALL');

  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [timeOffTotal, setTimeOffTotal] = useState(0);
  const [timeOffFilter, setTimeOffFilter] = useState<TimeOffStatus | 'ALL'>('PENDING');

  const [panel, setPanel] = useState<Panel>('none');
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(EMPTY_EMPLOYEE_FORM);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ name: '', description: '' });
  const [timeOffForm, setTimeOffForm] = useState<TimeOffForm>(EMPTY_TIMEOFF_FORM);

  const loadAll = useCallback(async () => {
    const session = loadSession();
    if (!session?.accessToken) {
      setError('No hay una sesión activa.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const [departmentPage, employeePage, timeOffPage] = await Promise.all([
        hrApi.listDepartments(session.accessToken).catch(() => ({ items: [] as Department[], total: 0 })),
        hrApi.listEmployees(session.accessToken, {
          departmentId: departmentFilter || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          limit: 100,
        }),
        hrApi.listTimeOff(session.accessToken, { status: timeOffFilter === 'ALL' ? undefined : timeOffFilter, limit: 100 }).catch(() => ({ items: [] as TimeOff[], total: 0 })),
      ]);
      setDepartments(departmentPage.items);
      setEmployees(employeePage.items);
      setEmployeesTotal(employeePage.total);
      setTimeOffs(timeOffPage.items);
      setTimeOffTotal(timeOffPage.total);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, statusFilter, timeOffFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const departmentById = useMemo(() => new Map(departments.map((d) => [d._id, d])), [departments]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e._id, e])), [employees]);
  const activeDepartments = departments.filter((d) => d.status === 'ACTIVE');
  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');

  const departmentLabel = (id?: string) => (id && departmentById.get(id)?.name) || 'Sin departamento';
  const employeeLabel = (id: string) => {
    const e = employeeById.get(id);
    return e ? `${e.firstName} ${e.lastName}` : 'Empleado';
  };

  const visibleEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.code.toLowerCase().includes(q));
  }, [employees, employeeSearch]);

  // ---- Employees ------------------------------------------------------------

  const openEmployeeForm = (employee?: Employee) => {
    setError('');
    setNotice('');
    if (employee) {
      setEditingEmployee(employee);
      setEmployeeForm({
        code: employee.code,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email ?? '',
        phone: employee.phone ?? '',
        departmentId: employee.departmentId ?? '',
        position: employee.position ?? '',
        location: employee.location ?? '',
      });
    } else {
      setEditingEmployee(null);
      setEmployeeForm(EMPTY_EMPLOYEE_FORM);
    }
    setPanel('employee');
  };

  const submitEmployee = async () => {
    if (!employeeForm.code.trim()) return setError('Ingresa el código del empleado.');
    if (!employeeForm.firstName.trim() || !employeeForm.lastName.trim()) return setError('Ingresa el nombre completo del empleado.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      if (editingEmployee) {
        await hrApi.updateEmployee(session.accessToken, editingEmployee._id, {
          firstName: employeeForm.firstName.trim(),
          lastName: employeeForm.lastName.trim(),
          email: employeeForm.email.trim() || null,
          phone: employeeForm.phone.trim() || null,
          departmentId: employeeForm.departmentId || null,
          position: employeeForm.position.trim() || null,
          location: employeeForm.location.trim() || null,
          expectedVersion: editingEmployee.version,
        });
        setNotice(`Empleado ${employeeForm.firstName} ${employeeForm.lastName} actualizado.`);
      } else {
        await hrApi.createEmployee(session.accessToken, {
          code: employeeForm.code.trim(),
          firstName: employeeForm.firstName.trim(),
          lastName: employeeForm.lastName.trim(),
          email: employeeForm.email.trim() || undefined,
          phone: employeeForm.phone.trim() || undefined,
          departmentId: employeeForm.departmentId || undefined,
          position: employeeForm.position.trim() || undefined,
          location: employeeForm.location.trim() || undefined,
        });
        setNotice(`Empleado ${employeeForm.code} registrado.`);
      }
      setPanel('none');
      setEditingEmployee(null);
      await loadAll();
    } catch (err) {
      setError(describeHrError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleEmployeeStatus = async (employee: Employee) => {
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      if (employee.status === 'ACTIVE') {
        await hrApi.deactivateEmployee(session.accessToken, employee._id);
      } else {
        await hrApi.updateEmployee(session.accessToken, employee._id, { status: 'ACTIVE', expectedVersion: employee.version });
      }
      await loadAll();
    } catch (err) {
      setError(describeHrError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openDepartmentForm = () => {
    setError('');
    setNotice('');
    setDepartmentForm({ name: '', description: '' });
    setPanel('department');
  };

  const submitDepartment = async () => {
    if (departmentForm.name.trim().length < 2) return setError('El nombre del departamento debe tener al menos 2 caracteres.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const created = await hrApi.createDepartment(session.accessToken, { name: departmentForm.name.trim(), description: departmentForm.description.trim() || undefined });
      setPanel('none');
      setNotice(`Departamento ${created.name} creado.`);
      await loadAll();
    } catch (err) {
      setError(describeHrError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---- Time off ---------------------------------------------------------------

  const openTimeOffForm = () => {
    setError('');
    setNotice('');
    setTimeOffForm(EMPTY_TIMEOFF_FORM);
    setPanel('timeoff');
  };

  const submitTimeOff = async () => {
    if (!timeOffForm.employeeId) return setError('Selecciona el empleado.');
    if (!timeOffForm.startDate.trim() || !timeOffForm.endDate.trim()) return setError('Ingresa las fechas de inicio y fin.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      await hrApi.createTimeOff(session.accessToken, {
        employeeId: timeOffForm.employeeId,
        type: timeOffForm.type,
        startDate: timeOffForm.startDate.trim(),
        endDate: timeOffForm.endDate.trim(),
        reason: timeOffForm.reason.trim() || undefined,
      });
      setPanel('none');
      setNotice('Solicitud de ausencia registrada.');
      await loadAll();
    } catch (err) {
      setError(describeHrError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (record: TimeOff, to: 'APPROVED' | 'REJECTED') => {
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      await hrApi.decideTimeOff(session.accessToken, record._id, to, record.version);
      setNotice(`Solicitud ${to === 'APPROVED' ? 'aprobada' : 'rechazada'}.`);
      await loadAll();
    } catch (err) {
      setError(describeHrError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const cancelTimeOff = async (record: TimeOff) => {
    if (!window.confirm('¿Confirmas cancelar esta solicitud de ausencia?')) return;
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      await hrApi.cancelTimeOff(session.accessToken, record._id, record.version);
      setNotice('Solicitud cancelada.');
      await loadAll();
    } catch (err) {
      setError(describeHrError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.textSecondary }}>Cargando RRHH...</Text>
      </View>
    );
  }

  const input = [styles.input, { color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong }];
  const select = { ...styles.select, color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.textPrimary }]}>Recursos Humanos</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>Personal, departamentos y ausencias</Text>
        </View>
        <View style={styles.actions}>
          {tab === 'employees' && canWrite ? <ActionButton label="+ Departamento" onPress={openDepartmentForm} variant="secondary" theme={t} /> : null}
          {tab === 'employees' && canWrite ? <ActionButton label="+ Empleado" onPress={() => openEmployeeForm()} theme={t} /> : null}
          {tab === 'timeoff' && (canWrite || canWriteSelf) ? <ActionButton label="+ Ausencia" onPress={openTimeOffForm} theme={t} /> : null}
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton label={`Empleados (${employeesTotal})`} active={tab === 'employees'} onPress={() => setTab('employees')} theme={t} />
        <TabButton label={`Ausencias (${timeOffTotal})`} active={tab === 'timeoff'} onPress={() => setTab('timeoff')} theme={t} />
      </View>

      {error ? <Banner tone="danger" text={error} theme={t} /> : null}
      {notice ? <Banner tone="success" text={notice} theme={t} /> : null}

      {panel === 'department' ? (
        <FormCard title="Nuevo departamento" onClose={() => setPanel('none')} theme={t}>
          <Field label="Nombre *" theme={t}>
            <TextInput value={departmentForm.name} onChangeText={(v: string) => setDepartmentForm((f) => ({ ...f, name: v }))} style={input} />
          </Field>
          <Field label="Descripción" theme={t}>
            <TextInput value={departmentForm.description} onChangeText={(v: string) => setDepartmentForm((f) => ({ ...f, description: v }))} style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitDepartment()} label="Crear departamento" theme={t} />
        </FormCard>
      ) : null}

      {panel === 'employee' ? (
        <FormCard title={editingEmployee ? 'Editar empleado' : 'Nuevo empleado'} onClose={() => setPanel('none')} theme={t}>
          <Field label="Código *" theme={t}>
            <TextInput value={employeeForm.code} onChangeText={(v: string) => setEmployeeForm((f) => ({ ...f, code: v }))} placeholder="EMP-01" editable={!editingEmployee} style={input} />
          </Field>
          <Field label="Nombre(s) *" theme={t}>
            <TextInput value={employeeForm.firstName} onChangeText={(v: string) => setEmployeeForm((f) => ({ ...f, firstName: v }))} style={input} />
          </Field>
          <Field label="Apellido(s) *" theme={t}>
            <TextInput value={employeeForm.lastName} onChangeText={(v: string) => setEmployeeForm((f) => ({ ...f, lastName: v }))} style={input} />
          </Field>
          <Field label="Correo" theme={t}>
            <TextInput value={employeeForm.email} onChangeText={(v: string) => setEmployeeForm((f) => ({ ...f, email: v }))} style={input} />
          </Field>
          <Field label="Teléfono" theme={t}>
            <TextInput value={employeeForm.phone} onChangeText={(v: string) => setEmployeeForm((f) => ({ ...f, phone: v }))} style={input} />
          </Field>
          <Field label="Departamento" theme={t}>
            <select value={employeeForm.departmentId} onChange={(e) => setEmployeeForm((f) => ({ ...f, departmentId: e.target.value }))} style={select}>
              <option value="">Sin departamento</option>
              {activeDepartments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Puesto" theme={t}>
            <TextInput value={employeeForm.position} onChangeText={(v: string) => setEmployeeForm((f) => ({ ...f, position: v }))} style={input} />
          </Field>
          <Field label="Ubicación" theme={t}>
            <TextInput value={employeeForm.location} onChangeText={(v: string) => setEmployeeForm((f) => ({ ...f, location: v }))} style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitEmployee()} label={editingEmployee ? 'Guardar cambios' : 'Crear empleado'} theme={t} />
        </FormCard>
      ) : null}

      {panel === 'timeoff' ? (
        <FormCard title="Nueva solicitud de ausencia" onClose={() => setPanel('none')} theme={t}>
          <Field label="Empleado *" theme={t}>
            <select value={timeOffForm.employeeId} onChange={(e) => setTimeOffForm((f) => ({ ...f, employeeId: e.target.value }))} style={select}>
              <option value="">Selecciona un empleado</option>
              {activeEmployees.map((e) => <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </Field>
          <Field label="Tipo" theme={t}>
            <select value={timeOffForm.type} onChange={(e) => setTimeOffForm((f) => ({ ...f, type: e.target.value as TimeOffType }))} style={select}>
              {(Object.keys(TIMEOFF_TYPE) as TimeOffType[]).map((k) => <option key={k} value={k}>{TIMEOFF_TYPE[k]}</option>)}
            </select>
          </Field>
          <Field label="Fecha inicio *" theme={t}>
            <TextInput value={timeOffForm.startDate} onChangeText={(v: string) => setTimeOffForm((f) => ({ ...f, startDate: v }))} placeholder="AAAA-MM-DD" style={input} />
          </Field>
          <Field label="Fecha fin *" theme={t}>
            <TextInput value={timeOffForm.endDate} onChangeText={(v: string) => setTimeOffForm((f) => ({ ...f, endDate: v }))} placeholder="AAAA-MM-DD" style={input} />
          </Field>
          <Field label="Motivo" theme={t}>
            <TextInput value={timeOffForm.reason} onChangeText={(v: string) => setTimeOffForm((f) => ({ ...f, reason: v }))} style={input} />
          </Field>
          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitTimeOff()} label="Enviar solicitud" theme={t} />
        </FormCard>
      ) : null}

      {tab === 'employees' ? (
        <>
          <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <TextInput value={employeeSearch} onChangeText={setEmployeeSearch} placeholder="Buscar por nombre o código..." placeholderTextColor={c.textMuted} style={[input, styles.search]} />
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} style={{ ...select, minWidth: 200 }}>
              <option value="">Todos los departamentos</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as EmployeeStatus | 'ALL')} style={{ ...select, minWidth: 160 }}>
              <option value="ALL">Todos los estados</option>
              {(Object.keys(EMPLOYEE_STATUS) as EmployeeStatus[]).map((s) => <option key={s} value={s}>{EMPLOYEE_STATUS[s].label}</option>)}
            </select>
          </View>

          {visibleEmployees.length === 0 ? (
            <Empty text="No hay empleados con los filtros actuales." theme={t} />
          ) : (
            <View style={[styles.table, { borderColor: c.borderStrong }]}>
              <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                {['Empleado', 'Departamento', 'Puesto', 'Estado', ''].map((col) => (
                  <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                ))}
              </View>
              {visibleEmployees.map((e) => {
                const meta = EMPLOYEE_STATUS[e.status];
                return (
                  <View key={e._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                    <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{e.code} · {e.firstName} {e.lastName}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{departmentLabel(e.departmentId)}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{e.position || '—'}</Text>
                    <StatusPill label={meta.label} tone={meta.tone} theme={t} />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {canWrite ? (
                        <TouchableOpacity onPress={() => openEmployeeForm(e)}>
                          <Text style={[styles.cell, { color: c.info }]}>Editar</Text>
                        </TouchableOpacity>
                      ) : null}
                      {canWrite ? (
                        <TouchableOpacity disabled={saving} onPress={() => void toggleEmployeeStatus(e)}>
                          <Text style={[styles.cell, { color: e.status === 'ACTIVE' ? c.danger : c.success }]}>
                            {e.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : (
        <>
          <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            {TIMEOFF_FILTERS.map((f) => (
              <TouchableOpacity key={f.id} onPress={() => setTimeOffFilter(f.id)} style={[styles.chip, timeOffFilter === f.id ? { backgroundColor: c.primary } : { borderWidth: 1, borderColor: c.borderStrong }]}>
                <Text style={{ color: timeOffFilter === f.id ? '#FFFFFF' : c.textSecondary, fontSize: 13, fontWeight: '700' }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {timeOffs.length === 0 ? (
            <Empty text="No hay solicitudes de ausencia con este filtro." theme={t} />
          ) : (
            <View style={[styles.table, { borderColor: c.borderStrong }]}>
              <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
                {['Empleado', 'Tipo', 'Periodo', 'Motivo', 'Estado', ''].map((col) => (
                  <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
                ))}
              </View>
              {timeOffs.map((record) => {
                const meta = TIMEOFF_STATUS[record.status];
                const actions = timeOffActions(record, permissions);
                return (
                  <View key={record._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                    <Text style={[styles.cell, { color: c.textPrimary, flex: 2 }]}>{employeeLabel(record.employeeId)}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{TIMEOFF_TYPE[record.type]}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{record.startDate} → {record.endDate}</Text>
                    <Text style={[styles.cell, { color: c.textSecondary }]}>{record.reason || '—'}</Text>
                    <StatusPill label={meta.label} tone={meta.tone} theme={t} />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {actions.includes('DECIDE') ? (
                        <>
                          <TouchableOpacity disabled={saving} onPress={() => void decide(record, 'APPROVED')}>
                            <Text style={[styles.cell, { color: c.success }]}>Aprobar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity disabled={saving} onPress={() => void decide(record, 'REJECTED')}>
                            <Text style={[styles.cell, { color: c.danger }]}>Rechazar</Text>
                          </TouchableOpacity>
                        </>
                      ) : null}
                      {actions.includes('CANCEL') ? (
                        <TouchableOpacity disabled={saving} onPress={() => void cancelTimeOff(record)}>
                          <Text style={[styles.cell, { color: c.textSecondary }]}>Cancelar</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

type ThemeT = ReturnType<typeof useTheme>;

function ActionButton({ label, onPress, variant = 'primary', theme }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary'; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, variant === 'primary' ? { backgroundColor: c.primary } : { borderWidth: 1, borderColor: c.borderStrong }]}>
      <Text style={[styles.buttonText, { color: variant === 'primary' ? '#FFFFFF' : c.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TabButton({ label, active, onPress, theme }: { label: string; active: boolean; onPress: () => void; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active ? { borderBottomColor: c.primary, borderBottomWidth: 2 } : null]}>
      <Text style={[styles.tabText, { color: active ? c.textPrimary : c.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Banner({ tone, text, theme }: { tone: 'danger' | 'success'; text: string; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={[styles.banner, { backgroundColor: tone === 'danger' ? c.dangerSoft : c.successSoft, borderColor: tone === 'danger' ? c.danger : c.success }]}>
      <Text accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={{ color: c.textPrimary, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

function StatusPill({ label, tone, theme }: { label: string; tone: Tone; theme: ThemeT }) {
  const c = theme.semanticColors;
  const toneColor: Record<Tone, string> = { neutral: c.textMuted, info: c.info, success: c.success, warning: c.warning, danger: c.danger };
  return (
    <View style={[styles.pill, { backgroundColor: toneColor[tone] }]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function FormCard({ title, onClose, children, theme }: { title: string; onClose: () => void; children: React.ReactNode; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={[styles.formCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
      <View style={styles.formHeader}>
        <Text style={[styles.formTitle, { color: c.textPrimary }]}>{title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: c.textSecondary, fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

function Field({ label, children, theme }: { label: string; children: React.ReactNode; theme: ThemeT }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.semanticColors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function FormActions({ saving, onCancel, onSubmit, label, theme }: { saving: boolean; onCancel: () => void; onSubmit: () => void; label: string; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={styles.formActions}>
      <TouchableOpacity onPress={onCancel} disabled={saving} style={[styles.button, { borderWidth: 1, borderColor: c.borderStrong }]}>
        <Text style={[styles.buttonText, { color: c.textSecondary }]}>Cancelar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSubmit} disabled={saving} style={[styles.button, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}>
        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{saving ? 'Guardando…' : label}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Empty({ text, theme }: { text: string; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
      <Text style={{ color: c.textSecondary, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 28, gap: 20, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 5, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 20 },
  tabText: { fontSize: 15, fontWeight: '700' },
  button: { minHeight: 42, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '700' },
  banner: { padding: 14, borderRadius: 10, borderWidth: 1 },
  toolbar: { borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 220 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  formCard: { borderWidth: 1, borderRadius: 16, padding: 22 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  field: { flexGrow: 1, flexBasis: '30%', minWidth: 220, gap: 7 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, outlineStyle: 'none' },
  select: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingLeft: 10, paddingRight: 10, fontSize: 14 },
  formActions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  empty: { borderWidth: 1, borderRadius: 14, padding: 24, alignItems: 'center' },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, paddingVertical: 11, paddingHorizontal: 12, fontSize: 13 },
  headCell: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', marginHorizontal: 4 },
  pillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
