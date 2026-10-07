import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ApiClientError,
  authApi,
  clearSession,
  friendlyMessage,
  loadSession,
  loginWithCompany,
  saveLastCompany,
  saveSession,
  sessionFromTokens,
  type AuthTenant,
  type AuthUser,
  type MeResponse,
  type RegisterInput,
  type StoredSession,
} from '../lib/api';
import { subscribeToSessionExpiry } from './sessionEvents';

interface AuthContextValue {
  signedIn: boolean;
  loading: boolean;
  userName: string;
  user: AuthUser | null;
  me: MeResponse | null;
  /** Company of the current session (name/slug for display only). */
  tenant: AuthTenant | null;
  error: string | null;

  /** Same flow as Web: company slug → tenantId → login scoped to that tenant. */
  signIn: (company: string, email: string, password: string) => Promise<void>;
  /** Resolves with the new company so the UI can show its login identifier. */
  register: (input: RegisterInput) => Promise<AuthTenant | null>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  signedIn: false,
  loading: true,
  user: null,
  userName: 'Operador',
  me: null,
  tenant: null,
  error: null,

  signIn: async () => undefined,
  register: async () => null,
  signOut: async () => undefined,
  clearError: () => undefined,
});

interface AuthProviderProps {
  children: React.ReactNode;
}

function isAuthRejection(err: unknown): boolean {
  return err instanceof ApiClientError && (err.status === 401 || err.status === 403);
}

export function AuthProvider({
  children,
}: AuthProviderProps): React.JSX.Element {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setSession(null);
    setUser(null);
    setMe(null);
    setTenant(null);
  }, []);

  useEffect(() => subscribeToSessionExpiry(() => {
    void clearSession().catch(() => undefined);
    resetState();
    setError('Tu sesión expiró. Inicia sesión nuevamente.');
  }), [resetState]);

  /**
   * Persists the session, then loads /me (membership, roles, permissions)
   * before flipping the navigator to the signed-in tree.
   */
  const activateSession = useCallback(async (next: StoredSession) => {
    await saveSession(next);

    if (next.tenant) {
      await saveLastCompany(next.tenant.slug).catch(() => undefined);
    }

    try {
      const response = await authApi.me(next.accessToken);
      // /me may have rotated the tokens through the 401 → refresh path.
      const current = (await loadSession()) ?? next;

      setSession(current);
      setTenant(current.tenant ?? null);
      setUser(response.user);
      setMe(response);
    } catch (err) {
      await clearSession().catch(() => undefined);
      throw err;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap(): Promise<void> {
      try {
        const storedSession = await loadSession();

        if (!storedSession || !mounted) {
          return;
        }

        // 401 → refresh → retry is handled centrally by apiRequest.
        const response = await authApi.me(storedSession.accessToken);
        const current = (await loadSession()) ?? storedSession;

        if (!mounted) {
          return;
        }

        setSession(current);
        setTenant(current.tenant ?? null);
        setUser(response.user);
        setMe(response);
      } catch (err) {
        if (!mounted) {
          return;
        }

        resetState();

        if (isAuthRejection(err)) {
          await clearSession().catch(() => undefined);
        } else {
          // Network/server failure (e.g. API cold start): keep the stored
          // tokens so the next launch can restore without a new login.
          setError(`No se pudo validar tu sesión. ${friendlyMessage(err)}`);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [resetState]);

  const signIn = useCallback(
    async (company: string, email: string, password: string): Promise<void> => {
      setError(null);

      try {
        const { tokens, tenant: resolved } = await loginWithCompany(company, email, password);

        await activateSession(sessionFromTokens(tokens, resolved));
      } catch (err) {
        setError(friendlyMessage(err));
        throw err;
      }
    },
    [activateSession],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<AuthTenant | null> => {
      setError(null);

      let created: StoredSession | null = null;

      try {
        const tokens = await authApi.register({
          ...input,
          companyName: input.companyName.trim(),
          username: input.username.trim(),
          email: input.email.trim(),
          firstName: input.firstName?.trim() || undefined,
          lastName: input.lastName?.trim() || undefined,
        });

        created = sessionFromTokens(tokens);
        await activateSession(created);

        return created.tenant ?? null;
      } catch (err) {
        const slug = created?.tenant?.slug;

        setError(
          slug
            ? `Tu empresa se registró con el identificador "${slug}", pero no se pudo abrir la sesión. Inicia sesión con ese identificador. (${friendlyMessage(err)})`
            : friendlyMessage(err),
        );
        throw err;
      }
    },
    [activateSession],
  );

  const signOut = useCallback(async (): Promise<void> => {
    // Read storage, not state: the access token may have been rotated.
    const stored = await loadSession().catch(() => null);

    setError(null);
    await clearSession().catch(() => undefined);
    resetState();

    if (stored?.accessToken) {
      void authApi.logout(stored.accessToken).catch(() => undefined);
    }
  }, [resetState]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      signedIn: session !== null && user !== null,
      loading,
      userName:
        user?.firstName ||
        user?.username ||
        'Operador',
      user,
      me,
      tenant,
      error,
      signIn,
      register,
      signOut,
      clearError,
    }),
    [
      session,
      user,
      loading,
      me,
      tenant,
      error,
      signIn,
      register,
      signOut,
      clearError,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
