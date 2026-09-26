import { ApiError, GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';

export class AiProviderError extends Error {
  constructor(message: string, public readonly status?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AiProviderError';
  }
}

export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
}

export interface GenerateJsonOptions<T> extends GenerateOptions {
  /** JSON Schema enviado ao Gemini para forçar o formato da resposta. */
  schema: Record<string, unknown>;
  /** Valida/normaliza o JSON recebido; retorna null se estiver fora do formato. */
  parse: (raw: unknown) => T | null;
}

// Timeout e retry (408/429/5xx) configurados uma vez no cliente.
const client = new GoogleGenAI({
  apiKey: env.geminiApiKey,
  httpOptions: {
    timeout: env.geminiTimeoutMs,
    retryOptions: { attempts: 3 },
  },
});

export class GeminiProvider {
  /** Gera texto livre (ex.: resposta do chat da Sun). */
  public static async generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const text = await this.generate(prompt, options);
    return text.trim();
  }

  /** Gera JSON estruturado, garantido pelo schema e validado antes de retornar. */
  public static async generateJson<T>(prompt: string, options: GenerateJsonOptions<T>): Promise<T> {
    const { schema, parse, ...rest } = options;
    const text = await this.generate(prompt, {
      ...rest,
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
    });

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      throw new AiProviderError('O Gemini retornou um JSON inválido.', undefined, { cause: err });
    }

    const parsed = parse(raw);
    if (parsed === null) {
      throw new AiProviderError('O JSON do Gemini veio fora do formato esperado.');
    }
    return parsed;
  }

  private static async generate(
    prompt: string,
    config: GenerateOptions & { responseMimeType?: string; responseJsonSchema?: unknown },
  ): Promise<string> {
    try {
      const response = await client.models.generateContent({
        model: env.geminiModel,
        contents: prompt,
        config,
      });

      const text = response.text;
      if (!text?.trim()) {
        throw new AiProviderError('O Gemini retornou uma resposta vazia (possível bloqueio de segurança).');
      }
      return text;
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      if (err instanceof ApiError) {
        throw new AiProviderError(`Erro da API do Gemini: ${err.message}`, err.status, { cause: err });
      }
      throw new AiProviderError('Falha de rede ou timeout ao chamar o Gemini.', undefined, { cause: err });
    }
  }
}
