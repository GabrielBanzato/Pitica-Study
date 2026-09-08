import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/dashboard', async (request, reply) => {
    const user = await prisma.user.findFirst({ where: { name: 'Lê' } });
    const totalQuestions = await prisma.question.count();
    const totalClasses = await prisma.class.count();
    const topics = await prisma.topic.findMany({
      include: { questions: true }
    });

    return {
      userName: user?.name || 'Lê',
      streak: user?.streak || 1,
      xp: user?.xp || 100,
      totalQuestions,
      totalClasses,
      topicsCount: topics.length,
      // Níveis de evolução temática do Pitica Study
      levelTitle: user && user.xp > 500 ? 'Top Model Nutri 👑' : user && user.xp > 200 ? 'Fashion Week 👠' : 'New Face 💖'
    };
  });
}