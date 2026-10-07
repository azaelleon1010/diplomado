/**
 * Administración (Web): roles (permisos granulares) y cuentas de usuario.
 *
 * AGENTS.md §30: nunca un simple admin/usuario — un rol es un conjunto
 * nombrado y editable de permisos del catálogo compartido
 * (packages/types/src/permissions.ts). El backend es la autoridad final
 * (permiso desconocido, nombre duplicado, el rol "owner" no se puede
 * desactivar, nadie puede desactivarse a sí mismo); esta pantalla solo
 * oculta botones que el servidor rechazaría.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { useAuth } from '../auth/AuthContext';
import { adminApi, friendlyMessage, loadSession } from '../lib/api';
import { hasPermission } from '../../../../packages/types/src/permissions';
import {
  PROTECTED_ROLE_NAME,
  describeAdminError,
  groupPermissions,
  readOnlyPermissions,
  type AccountStatus,
  type AdminUser,
  type Role,
} from '../../../../packages/types/src/admin';

type Tab = 'roles' | 'users';
type Panel = 'none' | 'role' | 'user';

interface RoleForm {
  name: string;
  description: string;
  permissions: Set<string>;
}

const EMPTY_ROLE_FORM: RoleForm = { name: '', description: '', permissions: new Set() };

interface UserForm {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  roleIds: Set<string>;
}

const EMPTY_USER_FORM: UserForm = { email: '', username: '', password: '', firstName: '', lastName: '', roleIds: new Set() };

export function AdministrationScreen() {
  const t = useTheme();
  const c = t.semanticColors;
  const { permissions, user } = useAuth();
  const canWrite = hasPermission(permissions, 'system.users.write');

  const [tab, setTab] = useState<Tab>('roles');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [panel, setPanel] = useState<Panel>('none');
  const [roleForm, setRoleForm] = useState<RoleForm>(EMPTY_ROLE_FORM);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(EMPTY_USER_FORM);

  const permissionGroups = useMemo(() => groupPermissions(), []);
  const readOnlySet = useMemo(() => new Set(readOnlyPermissions()), []);

  const loadAll = useCallback(async () => {
    const session = loadSession();
    if (!session?.accessToken) {
      setError('No hay una sesión activa.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const [roleList, userPage] = await Promise.all([
        adminApi.listRoles(session.accessToken),
        adminApi.listUsers(session.accessToken),
      ]);
      setRoles(roleList);
      setUsers(userPage.items);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activeRoles = roles.filter((r) => r.status === 'ACTIVE');

  // ---- Roles ------------------------------------------------------------

  const openRoleForm = (role?: Role) => {
    setError('');
    setNotice('');
    if (role) {
      setEditingRole(role);
      setRoleForm({ name: role.name, description: role.description ?? '', permissions: new Set(role.permissions) });
    } else {
      setEditingRole(null);
      setRoleForm(EMPTY_ROLE_FORM);
    }
    setPanel('role');
  };

  const togglePermission = (value: string) => {
    setRoleForm((f) => {
      const next = new Set(f.permissions);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...f, permissions: next };
    });
  };

  const applyTemplate = (template: 'none' | 'read' | 'all') => {
    setRoleForm((f) => {
      if (template === 'none') return { ...f, permissions: new Set() };
      if (template === 'all') return { ...f, permissions: new Set(permissionGroups.flatMap((g) => g.permissions.map((p) => p.value))) };
      return { ...f, permissions: new Set(readOnlySet) };
    });
  };

  const submitRole = async () => {
    if (roleForm.name.trim().length < 2) return setError('El nombre del rol debe tener al menos 2 caracteres.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      const permissions = [...roleForm.permissions];
      if (editingRole) {
        await adminApi.updateRole(session.accessToken, editingRole._id, {
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || undefined,
          permissions,
          expectedVersion: editingRole.version,
        });
        setNotice(`Rol ${roleForm.name.trim()} actualizado.`);
      } else {
        await adminApi.createRole(session.accessToken, { name: roleForm.name.trim(), description: roleForm.description.trim() || undefined, permissions });
        setNotice(`Rol ${roleForm.name.trim()} creado.`);
      }
      setPanel('none');
      setEditingRole(null);
      await loadAll();
    } catch (err) {
      setError(describeAdminError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleRoleStatus = async (role: Role) => {
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      await adminApi.updateRole(session.accessToken, role._id, { status: role.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE', expectedVersion: role.version });
      await loadAll();
    } catch (err) {
      setError(describeAdminError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---- Users --------------------------------------------------------------

  const openUserForm = () => {
    setError('');
    setNotice('');
    setUserForm(EMPTY_USER_FORM);
    setPanel('user');
  };

  const toggleUserRole = (roleId: string) => {
    setUserForm((f) => {
      const next = new Set(f.roleIds);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return { ...f, roleIds: next };
    });
  };

  const submitUser = async () => {
    if (!userForm.email.trim() || !userForm.username.trim()) return setError('Correo y usuario son obligatorios.');
    if (userForm.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      await adminApi.createUser(session.accessToken, {
        email: userForm.email.trim(),
        username: userForm.username.trim(),
        password: userForm.password,
        firstName: userForm.firstName.trim() || undefined,
        lastName: userForm.lastName.trim() || undefined,
        roleIds: [...userForm.roleIds],
      });
      setPanel('none');
      setNotice(`Usuario ${userForm.email.trim()} creado.`);
      await loadAll();
    } catch (err) {
      setError(describeAdminError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (targetUser: AdminUser, status: AccountStatus) => {
    const session = loadSession();
    if (!session?.accessToken) return setError('No hay una sesión activa.');
    try {
      setSaving(true);
      setError('');
      await adminApi.setUserStatus(session.accessToken, targetUser._id, status);
      await loadAll();
    } catch (err) {
      setError(describeAdminError(err) ?? friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.textSecondary }}>Cargando administración...</Text>
      </View>
    );
  }

  const input = [styles.input, { color: c.textPrimary, backgroundColor: c.background, borderColor: c.borderStrong }];

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.textPrimary }]}>Administración</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>Roles, permisos y cuentas de usuario</Text>
        </View>
        <View style={styles.actions}>
          {tab === 'roles' && canWrite ? <ActionButton label="+ Nuevo rol" onPress={() => openRoleForm()} theme={t} /> : null}
          {tab === 'users' && canWrite ? <ActionButton label="+ Nuevo usuario" onPress={openUserForm} theme={t} /> : null}
        </View>
      </View>

      <View style={styles.tabs}>
        <TabButton label={`Roles (${roles.length})`} active={tab === 'roles'} onPress={() => setTab('roles')} theme={t} />
        <TabButton label={`Usuarios (${users.length})`} active={tab === 'users'} onPress={() => setTab('users')} theme={t} />
      </View>

      {error ? <Banner tone="danger" text={error} theme={t} /> : null}
      {notice ? <Banner tone="success" text={notice} theme={t} /> : null}

      {panel === 'role' ? (
        <FormCard title={editingRole ? `Editar rol: ${editingRole.name}` : 'Nuevo rol'} onClose={() => setPanel('none')} theme={t}>
          <View style={styles.grid}>
            <Field label="Nombre *" theme={t}>
              <TextInput value={roleForm.name} onChangeText={(v: string) => setRoleForm((f) => ({ ...f, name: v }))} placeholder="Ej. Solo lectura" style={input} />
            </Field>
            <Field label="Descripción" theme={t}>
              <TextInput value={roleForm.description} onChangeText={(v: string) => setRoleForm((f) => ({ ...f, description: v }))} style={input} />
            </Field>
          </View>

          <View style={styles.templateRow}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Plantillas rápidas:</Text>
            <TouchableOpacity onPress={() => applyTemplate('read')} style={[styles.templateButton, { borderColor: c.borderStrong }]}>
              <Text style={{ color: c.textPrimary, fontSize: 12, fontWeight: '700' }}>Solo lectura</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => applyTemplate('all')} style={[styles.templateButton, { borderColor: c.borderStrong }]}>
              <Text style={{ color: c.textPrimary, fontSize: 12, fontWeight: '700' }}>Marcar todo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => applyTemplate('none')} style={[styles.templateButton, { borderColor: c.borderStrong }]}>
              <Text style={{ color: c.textPrimary, fontSize: 12, fontWeight: '700' }}>Ninguno</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: c.textSecondary, marginTop: 10 }]}>
            Permisos seleccionados: {roleForm.permissions.size}
          </Text>

          <View style={styles.permissionGroups}>
            {permissionGroups.map((group) => (
              <View key={group.module} style={[styles.permissionGroup, { borderColor: c.borderStrong, backgroundColor: c.surface }]}>
                <Text style={[styles.permissionGroupTitle, { color: c.textPrimary }]}>{group.label}</Text>
                <View style={styles.permissionChips}>
                  {group.permissions.map((p) => {
                    const checked = roleForm.permissions.has(p.value);
                    return (
                      <TouchableOpacity
                        key={p.value}
                        onPress={() => togglePermission(p.value)}
                        style={[styles.permissionChip, { borderColor: checked ? c.primary : c.borderStrong, backgroundColor: checked ? c.primary : 'transparent' }]}
                      >
                        <Text style={{ color: checked ? '#FFFFFF' : c.textSecondary, fontSize: 12, fontWeight: '600' }}>{p.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitRole()} label={editingRole ? 'Guardar cambios' : 'Crear rol'} theme={t} />
        </FormCard>
      ) : null}

      {panel === 'user' ? (
        <FormCard title="Nuevo usuario" onClose={() => setPanel('none')} theme={t}>
          <View style={styles.grid}>
            <Field label="Correo *" theme={t}>
              <TextInput value={userForm.email} onChangeText={(v: string) => setUserForm((f) => ({ ...f, email: v }))} placeholder="persona@empresa.mx" style={input} />
            </Field>
            <Field label="Usuario *" theme={t}>
              <TextInput value={userForm.username} onChangeText={(v: string) => setUserForm((f) => ({ ...f, username: v }))} style={input} />
            </Field>
            <Field label="Contraseña *" theme={t}>
              <TextInput value={userForm.password} onChangeText={(v: string) => setUserForm((f) => ({ ...f, password: v }))} secureTextEntry style={input} />
            </Field>
            <Field label="Nombre(s)" theme={t}>
              <TextInput value={userForm.firstName} onChangeText={(v: string) => setUserForm((f) => ({ ...f, firstName: v }))} style={input} />
            </Field>
            <Field label="Apellido(s)" theme={t}>
              <TextInput value={userForm.lastName} onChangeText={(v: string) => setUserForm((f) => ({ ...f, lastName: v }))} style={input} />
            </Field>
          </View>

          <Text style={[styles.label, { color: c.textSecondary, marginTop: 10 }]}>Roles asignados</Text>
          <View style={styles.permissionChips}>
            {activeRoles.length === 0 ? (
              <Text style={{ color: c.textSecondary, fontSize: 13 }}>No hay roles activos. Crea un rol primero.</Text>
            ) : (
              activeRoles.map((role) => {
                const checked = userForm.roleIds.has(role._id);
                return (
                  <TouchableOpacity
                    key={role._id}
                    onPress={() => toggleUserRole(role._id)}
                    style={[styles.permissionChip, { borderColor: checked ? c.primary : c.borderStrong, backgroundColor: checked ? c.primary : 'transparent' }]}
                  >
                    <Text style={{ color: checked ? '#FFFFFF' : c.textSecondary, fontSize: 12, fontWeight: '600' }}>{role.name}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <FormActions saving={saving} onCancel={() => setPanel('none')} onSubmit={() => void submitUser()} label="Crear usuario" theme={t} />
        </FormCard>
      ) : null}

      {tab === 'roles' ? (
        roles.length === 0 ? (
          <Empty text="No hay roles registrados." theme={t} />
        ) : (
          <View style={[styles.table, { borderColor: c.borderStrong }]}>
            <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
              {['Rol', 'Descripción', 'Permisos', 'Estado', ''].map((col) => (
                <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
              ))}
            </View>
            {roles.map((role) => {
              const isProtected = role.name === PROTECTED_ROLE_NAME;
              return (
                <View key={role._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                  <Text style={[styles.cell, { color: c.textPrimary, flex: 1.5 }]}>{role.name}{isProtected ? ' 🔒' : ''}</Text>
                  <Text style={[styles.cell, { color: c.textSecondary, flex: 2 }]}>{role.description || '—'}</Text>
                  <Text style={[styles.cell, { color: c.textSecondary }]}>{role.permissions.length}</Text>
                  <StatusPill label={role.status === 'ACTIVE' ? 'Activo' : 'Inactivo'} tone={role.status === 'ACTIVE' ? 'success' : 'neutral'} theme={t} />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {canWrite ? (
                      <TouchableOpacity onPress={() => openRoleForm(role)}>
                        <Text style={[styles.cell, { color: c.info }]}>Editar</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canWrite && !(isProtected && role.status === 'ACTIVE') ? (
                      <TouchableOpacity disabled={saving} onPress={() => void toggleRoleStatus(role)}>
                        <Text style={[styles.cell, { color: role.status === 'ACTIVE' ? c.danger : c.success }]}>
                          {role.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )
      ) : users.length === 0 ? (
        <Empty text="No hay usuarios registrados." theme={t} />
      ) : (
        <View style={[styles.table, { borderColor: c.borderStrong }]}>
          <View style={[styles.row, { backgroundColor: c.surfaceElevated }]}>
            {['Usuario', 'Correo', 'Roles', 'Estado', ''].map((col) => (
              <Text key={col} style={[styles.cell, styles.headCell, { color: c.textSecondary }]}>{col}</Text>
            ))}
          </View>
          {users.map((u) => {
            const isSelf = u._id === user?._id;
            return (
              <View key={u._id} style={[styles.row, { borderTopColor: c.borderStrong, borderTopWidth: 1, backgroundColor: c.surface }]}>
                <Text style={[styles.cell, { color: c.textPrimary, flex: 1.5 }]}>{u.username}{isSelf ? ' (tú)' : ''}</Text>
                <Text style={[styles.cell, { color: c.textSecondary, flex: 1.5 }]}>{u.email}</Text>
                <Text style={[styles.cell, { color: c.textSecondary, flex: 1.5 }]}>{u.roles.length > 0 ? u.roles.map((r) => r.name).join(', ') : 'Sin rol'}</Text>
                <StatusPill label={u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'} tone={u.status === 'ACTIVE' ? 'success' : 'neutral'} theme={t} />
                {canWrite && !isSelf ? (
                  <TouchableOpacity disabled={saving} onPress={() => void toggleUserStatus(u, u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}>
                    <Text style={[styles.cell, { color: u.status === 'ACTIVE' ? c.danger : c.success }]}>
                      {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.cell} />
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

type ThemeT = ReturnType<typeof useTheme>;

function ActionButton({ label, onPress, theme }: { label: string; onPress: () => void; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, { backgroundColor: c.primary }]}>
      <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{label}</Text>
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

function StatusPill({ label, tone, theme }: { label: string; tone: 'success' | 'neutral'; theme: ThemeT }) {
  const c = theme.semanticColors;
  return (
    <View style={[styles.pill, { backgroundColor: tone === 'success' ? c.success : c.textMuted }]}>
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
      {children}
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
  formCard: { borderWidth: 1, borderRadius: 16, padding: 22, gap: 12 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  formTitle: { fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  field: { flexGrow: 1, flexBasis: '30%', minWidth: 220, gap: 7 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, outlineStyle: 'none' },
  formActions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  templateButton: { minHeight: 32, paddingHorizontal: 12, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  permissionGroups: { gap: 12 },
  permissionGroup: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  permissionGroupTitle: { fontSize: 14, fontWeight: '800' },
  permissionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permissionChip: { minHeight: 30, paddingHorizontal: 10, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 24, alignItems: 'center' },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, paddingVertical: 11, paddingHorizontal: 12, fontSize: 13 },
  headCell: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', marginHorizontal: 4 },
  pillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
