import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE =
  (__DEV__
    ? 'http://10.0.2.2:3000'
    : 'https://diplomado-1.onrender.com'
  ).replace(/\/$/, '');

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    fields: Record<string, unknown>;
  };
  traceId: string;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.error.code;
    this.fields = body.error.fields ?? {};
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token
          ? { Authorization: `Bearer ${options.token}` }
          : {}),
      },
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch {
    throw new ApiClientError(0, {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          'No se pudo conectar con el servidor. Verifica que la API esté ejecutándose.',
        fields: {},
      },
      traceId: '',
    });
  }

  let parsed: unknown = null;

  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (
    !res.ok ||
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { success?: boolean }).success !== true
  ) {
    const body: ApiErrorBody = {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Request failed with status ${res.status}`,
        fields: {},
      },
      traceId: '',
    };

    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as { success?: boolean }).success === false
    ) {
      throw new ApiClientError(res.status, parsed as ApiErrorBody);
    }

    throw new ApiClientError(res.status, body);
  }

  return (parsed as { data: T }).data;
}

export interface AuthUser {
  _id: string;
  tenantId: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
}

export interface AuthTenant {
  tenantId: string;
  name: string;
  slug: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  tenantId: string;
  sessionId: string;
  user: AuthUser;
  permissions: string[];
  tenant?: AuthTenant;
}

export interface MeResponse {
  user: AuthUser;
  membership: {
    _id: string;
    tenantId: string;
    organizationId?: string;
    branchId?: string;
    status: string;
  };
  roles: Array<{
    _id: string;
    name: string;
    permissions: string[];
  }>;
  permissions: string[];
}

export interface RegisterInput {
  companyName: string;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export const authApi = {
  register: (input: RegisterInput) =>
    apiRequest<AuthTokens>('/api/v1/auth/register', {
      method: 'POST',
      body: input,
    }),

  login: (email: string, password: string) =>
    apiRequest<AuthTokens>('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email,
        password,
      },
    }),

  refresh: (refreshToken: string) =>
    apiRequest<AuthTokens>('/api/v1/auth/refresh', {
      method: 'POST',
      body: {
        refreshToken,
      },
    }),

  logout: (accessToken: string) =>
    apiRequest<{ loggedOut: boolean }>('/api/v1/auth/logout', {
      method: 'POST',
      token: accessToken,
    }),

  me: (accessToken: string) =>
    apiRequest<MeResponse>('/api/v1/me', {
      token: accessToken,
    }),
};

const SESSION_KEY = 'tramatech.session.v1';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  sessionId: string;
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredSession>;

    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      tenantId: parsed.tenantId ?? '',
      sessionId: parsed.sessionId ?? '',
    };
  } catch {
    return null;
  }
}

export async function saveSession(
  session: StoredSession,
): Promise<void> {
  await AsyncStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session),
  );
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export function friendlyMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Ocurrió un error inesperado.';
}