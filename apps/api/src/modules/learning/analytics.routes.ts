import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/dashboard', async (request) => {
    // Consultas independentes em paralelo; tópicos só são contados, não carregados
    const [user, totalQuestions, totalClasses, topicsCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: request.user.sub }, select: { name: true, streak: true, xp: true } }),
      prisma.question.count(),
      prisma.class.count(),
      prisma.topic.count(),
    ]);

    const xp = user?.xp ?? 100;

    return {
      userName: user?.name ?? 'Lê',
      streak: user?.streak ?? 1,
      xp,
      totalQuestions,
      totalClasses,
      topicsCount,
      // Níveis de evolução temática do Pitica Study
      levelTitle: xp > 500 ? 'Top Model Nutri 👑' : xp > 200 ? 'Fashion Week 👠' : 'New Face 💖'
    };
  });
}
