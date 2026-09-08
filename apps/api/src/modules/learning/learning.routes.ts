import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { FeedbackEngine } from '../feedback/feedback.service.js';
import { QwenProvider } from '../ai/qwen.provider.js';

const prisma = new PrismaClient();

export async function learningRoutes(app: FastifyInstance) {
  
  // Buscar questões para a Prática Diária
  app.get('/session', async (request, reply) => {
    let questions = await prisma.question.findMany({
      where: { isMastered: false },
      orderBy: [
        { incorrectCount: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 5,
      include: { topic: true }
    });

    // Fallback: se todas foram dominadas ou não houver não-dominadas, pega as mais recentes
    if (questions.length === 0) {
      questions = await prisma.question.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { topic: true }
      });
    }

    return questions;
  });

  // Modo Prova
  app.get('/exam-session', async (request, reply) => {
    const recentTopics = await prisma.topic.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });

    if (recentTopics.length === 0) {
      return reply.status(400).send({ error: 'Nenhum tópico encontrado para o simulado.' });
    }

    const topicsText = recentTopics.map(t => t.name).join(', ');

    const prompt = `
Crie um Simulado de Nível Avançado (Modo Prova) para a Lê.
Tópicos abordados: ${topicsText}.

REGRAS:
1. Retorne APENAS um JSON válido.
2. Crie 3 questões inéditas e afirmativas baseadas nos tópicos.
3. Não inclua analogias ou dicas.

FORMATO ESPERADO:
{
  "questions": [
    {
      "statement": "Enunciado da questão...",
      "options": { "A": "Opção A", "B": "Opção B", "C": "Opção C", "D": "Opção D" },
      "answer": "A",
      "explanation": "Explicação técnica direta."
    }
  ]
}
`;

    try {
      const responseText = await QwenProvider.analyzeClassTranscript(prompt);
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(responseText.substring(jsonStart, jsonEnd));
        return parsed.questions;
      }
    } catch (err) {
      console.error('Erro ao gerar Modo Prova:', err);
    }

    return [];
  });

  // Registrar Resposta
  app.post('/answer', async (request, reply) => {
    const { questionId, selectedOption } = request.body as any;

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      return reply.status(404).send({ error: 'Questão não encontrada' });
    }

    const isCorrect = question.answer === selectedOption;
    const newCorrectCount = isCorrect ? question.correctCount + 1 : 0;
    const newIncorrectCount = !isCorrect ? question.incorrectCount + 1 : question.incorrectCount;
    const isMastered = newCorrectCount >= 3;

    await prisma.question.update({
      where: { id: questionId },
      data: {
        correctCount: newCorrectCount,
        incorrectCount: newIncorrectCount,
        isMastered
      }
    });

    const user = await prisma.user.findFirst({ where: { name: 'Lê' } });
    let currentStreak = user ? user.streak : 1;

    if (isCorrect && user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { xp: user.xp + 15 }
      });
    }

    const feedback = FeedbackEngine.getFeedback({
      type: isCorrect ? 'CORRECT' : 'INCORRECT',
      difficulty: 'MEDIUM',
      streakCount: currentStreak
    });

    return {
      isCorrect,
      streakCount: currentStreak,
      feedback: feedback.message,
      explanation: question.explanation,
      isMastered
    };
  });
}