import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, setUnauthorizedHandler, tokenStorage } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  streak: number;
  xp: number;
  createdAt: string;
}

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

interface SessionResponse {
  token: string;
  user: AuthUser;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Mensagem amigável para respostas de erro da API de autenticação. */
function authErrorMessage(status: number, body: { error?: string }): string {
  if (status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo. ⏳';
  if (status === 400) return 'Confira o e-mail e a senha (mínimo de 8 caracteres).';
  return body.error || 'Não foi possível conectar agora. Tente de novo! 😅';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (tokenStorage.get() ? 'loading' : 'anonymous'));

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Qualquer 401 em rota privada (token expirado) desloga
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Ao abrir o app, valida o token salvo antes de liberar as rotas privadas
  useEffect(() => {
    if (!tokenStorage.get()) return;
    let cancelled = false;

    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('Sessão inválida');
        const data: { user: AuthUser } = await res.json();
        if (cancelled) return;
        setUser(data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) logout();
      });

    return () => {
      cancelled = true;
    };
  }, [logout]);

  const startSession = useCallback(async (path: string, payload: Record<string, string>) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(authErrorMessage(res.status, body));

    const session = body as SessionResponse;
    tokenStorage.set(session.token);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    (email: string, password: string) => startSession('/api/auth/login', { email, password }),
    [startSession],
  );

  const register = useCallback(
    (email: string, password: string, name?: string) =>
      startSession('/api/auth/register', { email, password, ...(name ? { name } : {}) }),
    [startSession],
  );

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
