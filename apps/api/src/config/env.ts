import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`❌ Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function secret(name: string, minLength: number): string {
  const value = required(name);
  if (value.length < minLength) {
    throw new Error(`❌ ${name} precisa ter pelo menos ${minLength} caracteres.`);
  }
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function positiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Configuração validada na inicialização: se faltar algo obrigatório,
 * a API não sobe (falha rápida com mensagem clara em vez de erro em runtime).
 */
export const env = Object.freeze({
  port: positiveInt('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  geminiApiKey: required('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
  geminiTimeoutMs: positiveInt('GEMINI_TIMEOUT_MS', 90_000),
  jwtSecret: secret('JWT_SECRET', 32),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '7d',
  /** Cadastro público desligado por padrão: o site é público via Tunnel e as contas são criadas pelo script user:create. */
  allowRegistration: bool('ALLOW_REGISTRATION', false),
});

export type Env = typeof env;
