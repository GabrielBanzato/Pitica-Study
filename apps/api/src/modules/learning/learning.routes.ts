import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { FeedbackEngine } from '../feedback/feedback.service.js';
import { GeminiProvider } from '../ai/gemini.provider.js';
import { SUN_SYSTEM_INSTRUCTION } from '../ai/question-generator.service.js';
import { OPTION_KEYS, OptionKey, parseQuestionList, questionListJsonSchema } from '../ai/question.schema.js';

interface AnswerBody {
  questionId: string;
  selectedOption: OptionKey;
}

const answerBodySchema = {
  type: 'object',
  required: ['questionId', 'selectedOption'],
  properties: {
    questionId: { type: 'string', format: 'uuid' },
    selectedOption: { type: 'string', enum: [...OPTION_KEYS] },
  },
} as const;

export async function learningRoutes(app: FastifyInstance) {

  // Buscar questões para a Prática Diária
  app.get('/session', async () => {
    const questions = await prisma.question.findMany({
      where: { isMastered: false },
      orderBy: [
        { incorrectCount: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 5,
      include: { topic: true }
    });

    // Fallback: se todas foram dominadas ou não houver não-dominadas, pega as mais recentes
    if (questions.length > 0) return questions;

    return prisma.question.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { topic: true }
    });
  });

  // Modo Prova
  app.get('/exam-session', async (request) => {
    const recentTopics = await prisma.topic.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { name: true }
    });

    // Sem aulas processadas ainda: não é erro do cliente, só não há simulado
    if (recentTopics.length === 0) {
      return [];
    }

    const prompt = `
Crie um Simulado de Nível Avançado (Modo Prova) para a Lê.
Tópicos abordados: ${recentTopics.map(t => t.name).join(', ')}.

REGRAS:
1. Crie 3 questões inéditas e afirmativas baseadas nos tópicos.
2. Não inclua analogias ou dicas.
3. "explanation" traz uma explicação técnica direta.
`;

    try {
      return await GeminiProvider.generateJson(prompt, {
        systemInstruction: SUN_SYSTEM_INSTRUCTION,
        schema: questionListJsonSchema,
        parse: parseQuestionList,
      });
    } catch (err) {
      request.log.error({ err }, 'Erro ao gerar Modo Prova');
      return [];
    }
  });

  // Registrar Resposta
  app.post<{ Body: AnswerBody }>('/answer', { schema: { body: answerBodySchema } }, async (request, reply) => {
    const { questionId, selectedOption } = request.body;

    const [question, user] = await Promise.all([
      prisma.question.findUnique({ where: { id: questionId } }),
      prisma.user.findFirst({ where: { name: 'Lê' } }),
    ]);
    if (!question) {
      return reply.status(404).send({ error: 'Questão não encontrada' });
    }

    const isCorrect = question.answer === selectedOption;
    const newCorrectCount = isCorrect ? question.correctCount + 1 : 0;
    const isMastered = newCorrectCount >= 3;
    const streakCount = user?.streak ?? 1;

    await Promise.all([
      prisma.question.update({
        where: { id: questionId },
        data: {
          correctCount: newCorrectCount,
          incorrectCount: isCorrect ? undefined : { increment: 1 },
          isMastered
        }
      }),
      // Incremento atômico: respostas simultâneas não sobrescrevem o XP uma da outra
      isCorrect && user
        ? prisma.user.update({ where: { id: user.id }, data: { xp: { increment: 15 } } })
        : undefined,
    ]);

    const feedback = FeedbackEngine.getFeedback({
      type: isCorrect ? 'CORRECT' : 'INCORRECT',
      difficulty: 'MEDIUM',
      streakCount
    });

    return {
      isCorrect,
      streakCount,
      feedback: feedback.message,
      explanation: question.explanation,
      isMastered
    };
  });
}
