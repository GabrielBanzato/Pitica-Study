export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export type QuestionOptions = Record<OptionKey, string>;

export interface GeneratedQuestion {
  statement: string;
  options: QuestionOptions;
  answer: OptionKey;
  explanation: string;
}

/** JSON Schema de uma questão de múltipla escolha (usado no `responseJsonSchema` do Gemini). */
export const questionJsonSchema = {
  type: 'object',
  properties: {
    statement: { type: 'string' },
    options: {
      type: 'object',
      properties: Object.fromEntries(OPTION_KEYS.map((key) => [key, { type: 'string' }])),
      required: [...OPTION_KEYS],
    },
    answer: { type: 'string', enum: [...OPTION_KEYS] },
    explanation: { type: 'string' },
  },
  required: ['statement', 'options', 'answer', 'explanation'],
} as const;

export const questionListJsonSchema = {
  type: 'object',
  properties: {
    questions: { type: 'array', items: questionJsonSchema },
  },
  required: ['questions'],
} as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionKey(value: unknown): value is OptionKey {
  return typeof value === 'string' && (OPTION_KEYS as readonly string[]).includes(value);
}

export function isGeneratedQuestion(value: unknown): value is GeneratedQuestion {
  if (!isRecord(value) || !isRecord(value.options)) return false;
  const options = value.options;
  return (
    isNonEmptyString(value.statement) &&
    isNonEmptyString(value.explanation) &&
    isOptionKey(value.answer) &&
    OPTION_KEYS.every((key) => isNonEmptyString(options[key]))
  );
}

/** Mantém só as questões válidas; retorna null se não houver nenhuma aproveitável. */
export function parseQuestionList(raw: unknown): GeneratedQuestion[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.questions)) return null;
  const questions = raw.questions.filter(isGeneratedQuestion);
  return questions.length > 0 ? questions : null;
}
