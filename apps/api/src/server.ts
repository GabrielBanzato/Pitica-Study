import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { FeedbackEngine } from './modules/feedback/feedback.service.js';
import { classesRoutes } from './modules/classes/classes.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { learningRoutes } from './modules/learning/learning.routes.js';
import { analyticsRoutes } from './modules/learning/analytics.routes.js';

dotenv.config();

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

app.register(cors, { origin: true });

app.register(multipart, {
  limits: { fileSize: 500 * 1024 * 1024 }
});

app.register(classesRoutes, { prefix: '/api/classes' });
app.register(tasksRoutes, { prefix: '/api/tasks' });
app.register(learningRoutes, { prefix: '/api/learning' });
app.register(analyticsRoutes, { prefix: '/api/analytics' });

app.get('/', async () => {
  return { 
    app: 'Pitica Study API 🧠❤️', 
    status: 'online',
    message: 'Sistema feito com todo o carinho para a Lê! ✨'
  };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    
    let leUser = await prisma.user.findFirst({ where: { name: 'Lê' } });
    if (!leUser) {
      leUser = await prisma.user.create({
        data: { name: 'Lê', streak: 1, xp: 100 },
      });
      console.log('✨ Usuária Lê cadastrada com sucesso!');
    }

    await app.listen({ port, host: '0.0.0.0' });
    console.log(`\n✨ Pitica Study API rodando na porta ${port}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();