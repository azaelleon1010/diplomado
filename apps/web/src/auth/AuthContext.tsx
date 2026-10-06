import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ApiClientError,
  authApi,
  clearSession,
  loadSession,
  saveSession,
  type AuthTenant,
  type AuthUser,
  type RegisterInput,
  type StoredSession,
} from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  permissions: string[];
  loading: boolean;
  login: (email: string, password: string, tenantId: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  tenant: null,
  permissions: [],
  loading: true,
  login: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined,
});

function toSession(result: { accessToken: string; refreshToken: string; tenantId: string; sessionId: string }): StoredSession {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    tenantId: result.tenantId,
    sessionId: result.sessionId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Restore session on boot: stored access token -> GET /me.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const stored = loadSession();
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.me(stored.accessToken);
        if (cancelled) return;
        setUser(me.user);
        setPermissions(me.permissions);
        setTenant((prev) => prev);
      } catch (err) {
        // Try one refresh before giving up (access token may have expired).
        if (err instanceof ApiClientError && err.status === 401) {
          try {
            const rotated = await authApi.refresh(stored.refreshToken);
            if (cancelled) return;
            saveSession(toSession(rotated));
            const me = await authApi.me(rotated.accessToken);
            if (cancelled) return;
            setUser(me.user);
            setPermissions(me.permissions);
            setTenant(rotated.tenant ?? null);
          } catch {
            if (!cancelled) {
              clearSession();
            }
          }
        } else if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, tenantId: string) => {
    const result = await authApi.login(email, password, tenantId);
    saveSession(toSession(result));
    setUser(result.user);
    setTenant(result.tenant ?? null);
    setPermissions(result.permissions);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await authApi.register(input);
    saveSession(toSession(result));
    setUser(result.user);
    setTenant(result.tenant ?? null);
    setPermissions(result.permissions);
  }, []);

  const logout = useCallback(async () => {
    const stored = loadSession();
    clearSession();
    setUser(null);
    setTenant(null);
    setPermissions([]);
    if (stored) {
      try {
        await authApi.logout(stored.accessToken);
      } catch {
        // Expired token or network issue: local session is already cleared.
      }
    }
  }, []);

  const value = useMemo(
    () => ({ user, tenant, permissions, loading, login, register, logout }),
    [user, tenant, permissions, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
