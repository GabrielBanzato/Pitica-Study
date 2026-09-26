import { env } from './config/env.js'; // primeiro import: carrega e valida o .env
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { prisma } from './lib/prisma.js';
import { authenticate } from './plugins/auth.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { classesRoutes } from './modules/classes/classes.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { learningRoutes } from './modules/learning/learning.routes.js';
import { analyticsRoutes } from './modules/learning/analytics.routes.js';

// trustProxy: a API fica atrás do nginx (e do Cloudflare), request.ip vem do X-Forwarded-For
const app = Fastify({ logger: true, trustProxy: true });

app.register(cors, { origin: true });

app.register(fastifyJwt, {
  secret: env.jwtSecret,
  sign: { expiresIn: env.jwtExpiresIn },
});

app.register(multipart, {
  limits: { fileSize: 500 * 1024 * 1024, files: 1 }
});

// Rotas públicas
app.register(authRoutes, { prefix: '/api/auth' });

app.get('/', async () => {
  return {
    app: 'Pitica Study API 🧠❤️',
    status: 'online',
    message: 'Sistema feito com todo o carinho para a Lê! ✨'
  };
});

// Rotas privadas: todo o restante da API exige Bearer Token válido
app.register(async (privateScope) => {
  privateScope.addHook('onRequest', authenticate);

  privateScope.register(classesRoutes, { prefix: '/api/classes' });
  privateScope.register(tasksRoutes, { prefix: '/api/tasks' });
  privateScope.register(learningRoutes, { prefix: '/api/learning' });
  privateScope.register(analyticsRoutes, { prefix: '/api/analytics' });
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
    await app.listen({ port: env.port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
