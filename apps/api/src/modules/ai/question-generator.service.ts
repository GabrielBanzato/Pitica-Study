import { ensureSubject, prisma } from '../../lib/prisma.js';
import { GeminiProvider } from './gemini.provider.js';
import {
  GeneratedQuestion,
  isNonEmptyString,
  isRecord,
  parseQuestionList,
  questionJsonSchema,
} from './question.schema.js';

/** Limite de caracteres do material enviado ao Gemini (PDFs grandes são truncados aqui). */
const MAX_CONTENT_CHARS = 30_000;

export const SUN_SYSTEM_INSTRUCTION =
  'Você é a Sun (Sunfl.IA.wer) 🌻, a Tutora de IA do "Pitica Study", assistente de estudos de Nutrição da Lê (namorada do seu criador).';

export interface QuestionGenerationInput {
  /** Texto-base: PDF, OCR de print ou explicação de um tópico da aula. */
  content: string;
  /** Anexa as questões a um tópico já existente (fluxo das aulas). */
  topicId?: string;
  classId?: string;
  subjectId?: string;
}

export interface QuestionGenerationResult {
  topicId: string;
  topicName: string;
  questionsCreated: number;
}

interface GeneratedQuestionSet {
  topicName: string;
  fashionText: string;
  questions: GeneratedQuestion[];
}

const questionSetJsonSchema = {
  type: 'object',
  properties: {
    topicName: { type: 'string' },
    fashionText: { type: 'string' },
    questions: { type: 'array', items: questionJsonSchema },
  },
  required: ['topicName', 'fashionText', 'questions'],
};

function parseQuestionSet(raw: unknown): GeneratedQuestionSet | null {
  const questions = parseQuestionList(raw);
  if (!questions || !isRecord(raw)) return null;
  return {
    topicName: isNonEmptyString(raw.topicName) ? raw.topicName.trim() : 'Tópico de Estudo',
    fashionText: isNonEmptyString(raw.fashionText) ? raw.fashionText.trim() : 'Modo Fashion ativo! 👗✨',
    questions,
  };
}

function buildPrompt(content: string): string {
  return `
Com base no texto abaixo, crie 2 questões de múltipla escolha.

REGRAS OBRIGATÓRIAS:
1. Crie APENAS perguntas afirmativas e diretas.
2. O campo "fashionText" deve conter uma analogia conceitual e leve sobre o assunto.
3. PROIBIDO USAR AS MESMAS PALAVRAS OU A MESMA METÁFORA DO "fashionText" NAS ALTERNATIVAS DAS QUESTÕES! As alternativas (A, B, C, D) devem avaliar o conceito farmacológico/fisiológico REAL do corpo humano, sem dar a resposta de mão beijada pela analogia.
4. "topicName" é o nome curto do assunto principal do texto.
5. "explanation" traz a explicação técnica do motivo da resposta correta.

TEXTO PARA ANÁLISE:
"""
${content.slice(0, MAX_CONTENT_CHARS)}
"""
`;
}

export class QuestionGeneratorService {
  /**
   * Envia o texto (PDF, OCR ou tópico de aula) ao Gemini e persiste as questões geradas.
   * Lança erro em caso de falha — cabe ao chamador decidir como reportar.
   */
  public static async processAndGenerateQuestions(
    input: QuestionGenerationInput,
  ): Promise<QuestionGenerationResult> {
    const content = input.content.trim();
    if (!content) {
      throw new Error('Conteúdo vazio: não há texto para gerar questões.');
    }

    const generated = await GeminiProvider.generateJson(buildPrompt(content), {
      systemInstruction: SUN_SYSTEM_INSTRUCTION,
      schema: questionSetJsonSchema,
      parse: parseQuestionSet,
    });

    const toQuestionRows = (topicId: string) =>
      generated.questions.map((q) => ({
        topicId,
        statement: q.statement,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        difficulty: 'MEDIUM',
      }));

    // Fluxo das aulas: o tópico já existe, só anexamos as questões a ele.
    if (input.topicId) {
      const topic = await prisma.topic.findUniqueOrThrow({ where: { id: input.topicId } });
      const { count } = await prisma.question.createMany({ data: toQuestionRows(topic.id) });
      return { topicId: topic.id, topicName: topic.name, questionsCreated: count };
    }

    const classId = input.classId ?? (await this.ensureExerciseClass(input.subjectId));

    // Tópico e questões são gravados juntos: ou salva tudo, ou nada.
    return prisma.$transaction(async (tx) => {
      const topic = await tx.topic.create({
        data: { classId, name: generated.topicName, fashionText: generated.fashionText },
      });
      const { count } = await tx.question.createMany({ data: toQuestionRows(topic.id) });
      return { topicId: topic.id, topicName: topic.name, questionsCreated: count };
    });
  }

  /** Aula genérica que agrupa as questões vindas de PDFs e prints. */
  private static async ensureExerciseClass(subjectId?: string): Promise<string> {
    const subject = await ensureSubject(subjectId);
    const existing = await prisma.class.findFirst({ where: { subjectId: subject.id } });
    if (existing) return existing.id;

    const created = await prisma.class.create({
      data: { title: 'Exercícios de Fixação', subjectId: subject.id, status: 'COMPLETED' },
    });
    return created.id;
  }
}
