'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from './api';
import type { Role } from './types';

interface StoredAuth {
  token: string;
  email: string;
}

interface AuthContextValue {
  ready: boolean;
  token: string | null;
  email: string | null;
  role: Role | null;
  login(email: string, password: string): Promise<void>;
  logout(): void;
}

const STORAGE_KEY = 'etm.auth';
const AuthContext = createContext<AuthContextValue | null>(null);

function roleFromToken(token: string): Role | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const role = (claims as { role?: unknown }).role;
    return role === 'admin' || role === 'customer' ? role : null;
  } catch {
    return null;
  }
}

function readStored(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (typeof parsed.token === 'string' && typeof parsed.email === 'string') {
      return { token: parsed.token, email: parsed.email };
    }
  } catch {
    // Storage blocked or corrupted: treat as logged out.
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuth(readStored());
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await apiFetch<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    const next = { token: accessToken, email: email.trim().toLowerCase() };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: stay logged in for this page only.
    }
    setAuth(next);
  }, []);

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to remove.
    }
    setAuth(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      token: auth?.token ?? null,
      email: auth?.email ?? null,
      role: auth ? roleFromToken(auth.token) : null,
      login,
      logout,
    }),
    [ready, auth, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

export function useRequireAuth(requiredRole?: Role) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.ready) {
      return;
    }
    if (!auth.token) {
      router.replace('/login');
    } else if (requiredRole && auth.role !== requiredRole) {
      router.replace('/orders');
    }
  }, [auth.ready, auth.token, auth.role, requiredRole, router]);

  const allowed = auth.ready && auth.token !== null && (!requiredRole || auth.role === requiredRole);
  return { ...auth, allowed };
}