import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`❌ Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
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
});

export type Env = typeof env;
