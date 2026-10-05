import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  authApi,
  clearSession,
  friendlyMessage,
  loadSession,
  saveSession,
  type AuthTokens,
  type AuthUser,
  type MeResponse,
  type RegisterInput,
  type StoredSession,
} from '../lib/api';

interface AuthContextValue {
  signedIn: boolean;
  loading: boolean;
  userName: string;
  user: AuthUser | null;
  me: MeResponse | null;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  signedIn: false,
  loading: true,
  user: null,
  userName: 'Operador',
  me: null,
  error: null,

  signIn: async () => undefined,
  register: async () => undefined,
  signOut: async () => undefined,
  clearError: () => undefined,
});

interface AuthProviderProps {
  children: React.ReactNode;
}

function sessionFromTokens(tokens: AuthTokens): StoredSession {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tenantId: tokens.tenantId,
    sessionId: tokens.sessionId,
  };
}

export function AuthProvider({
  children,
}: AuthProviderProps): React.JSX.Element {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyTokens = useCallback(async (tokens: AuthTokens) => {
    const nextSession = sessionFromTokens(tokens);

    await saveSession(nextSession);

    setSession(nextSession);
    setUser(tokens.user);
  }, []);

  const loadCurrentUser = useCallback(
    async (storedSession: StoredSession): Promise<boolean> => {
      try {
        const response = await authApi.me(storedSession.accessToken);

        setSession(storedSession);
        setUser(response.user);
        setMe(response);

        return true;
      } catch {
        try {
          const refreshed = await authApi.refresh(
            storedSession.refreshToken,
          );

          const refreshedSession = sessionFromTokens(refreshed);

          await saveSession(refreshedSession);

          setSession(refreshedSession);
          setUser(refreshed.user);

          const response = await authApi.me(
            refreshedSession.accessToken,
          );

          setMe(response);

          return true;
        } catch {
          await clearSession();

          setSession(null);
          setUser(null);
          setMe(null);

          return false;
        }
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap(): Promise<void> {
      try {
        const storedSession = await loadSession();

        if (!mounted) {
          return;
        }

        if (!storedSession) {
          return;
        }

        await loadCurrentUser(storedSession);
      } catch {
        if (mounted) {
          await clearSession();
          setSession(null);
          setUser(null);
          setMe(null);
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
  }, [loadCurrentUser]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      setError(null);

      try {
        const tokens = await authApi.login(email.trim(), password);

        await applyTokens(tokens);

        const response = await authApi.me(tokens.accessToken);

        setMe(response);
        setUser(response.user);
      } catch (err) {
        setError(friendlyMessage(err));
        throw err;
      }
    },
    [applyTokens],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<void> => {
      setError(null);

      try {
        const tokens = await authApi.register({
          ...input,
          companyName: input.companyName.trim(),
          username: input.username.trim(),
          email: input.email.trim(),
          firstName: input.firstName?.trim(),
          lastName: input.lastName?.trim(),
        });

        await applyTokens(tokens);

        const response = await authApi.me(tokens.accessToken);

        setMe(response);
        setUser(response.user);
      } catch (err) {
        setError(friendlyMessage(err));
        throw err;
      }
    },
    [applyTokens],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const currentSession = session;

    setError(null);

    try {
      if (currentSession?.accessToken) {
        await authApi.logout(currentSession.accessToken);
      }
    } catch {
      // Aunque el servidor falle, eliminamos la sesión local.
    } finally {
      await clearSession();

      setSession(null);
      setUser(null);
      setMe(null);
    }
  }, [session]);

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