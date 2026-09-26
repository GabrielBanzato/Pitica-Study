import { env } from './config/env.js'; // primeiro import: carrega e valida o .env
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { prisma } from './lib/prisma.js';
import { classesRoutes } from './modules/classes/classes.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { learningRoutes } from './modules/learning/learning.routes.js';
import { analyticsRoutes } from './modules/learning/analytics.routes.js';

const app = Fastify({ logger: true });

app.register(cors, { origin: true });

app.register(multipart, {
  limits: { fileSize: 500 * 1024 * 1024, files: 1 }
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

// Rede de segurança: uma promise esquecida em segundo plano não derruba o servidor
process.on('unhandledRejection', (reason) => {
  app.log.error({ err: reason }, 'Promise rejeitada sem tratamento');
});

// Encerramento limpo (docker stop / redeploy no Portainer)
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    app.log.info(`${signal} recebido, encerrando...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

const start = async () => {
  try {
    const leUser = await prisma.user.findFirst({ where: { name: 'Lê' } });
    if (!leUser) {
      await prisma.user.create({ data: { name: 'Lê', streak: 1, xp: 100 } });
      app.log.info('✨ Usuária Lê cadastrada com sucesso!');
    }

    await app.listen({ port: env.port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
