const TOKEN_KEY = 'pitica.token';

/** Acesso ao token salvo (localStorage pode falhar em aba anônima/bloqueada). */
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* segue só com o token em memória */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nada a limpar */
    }
  },
};

let unauthorizedHandler: (() => void) | null = null;

/** Registrado pelo AuthContext: chamado quando o servidor recusa o token (401). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

/**
 * `fetch` com interceptor: injeta `Authorization: Bearer <token>` e,
 * se o token expirou ou foi revogado (401), encerra a sessão.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStorage.get();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401 && token) {
    unauthorizedHandler?.();
  }
  return res;
}
