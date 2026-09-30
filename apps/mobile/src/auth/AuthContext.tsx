import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface AuthContextValue {
  signedIn: boolean;
  userName: string;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  signedIn: false,
  userName: 'Operador',
  signIn: () => undefined,
  signOut: () => undefined,
});

interface AuthProviderProps {
  children: React.ReactNode;
}

/** Mock authentication for Fase 2. Real auth arrives with the API phase. */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [signedIn, setSignedIn] = useState(false);

  const signIn = useCallback(() => setSignedIn(true), []);
  const signOut = useCallback(() => setSignedIn(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({ signedIn, userName: 'Alejandro León', signIn, signOut }),
    [signedIn, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
