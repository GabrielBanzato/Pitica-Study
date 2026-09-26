import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { authenticate } from '../../plugins/auth.js';
import { AuthController, LoginBody, RegisterBody } from './auth.controller.js';

const emailSchema = { type: 'string', format: 'email', maxLength: 254 } as const;

const registerBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: emailSchema,
    password: { type: 'string', minLength: 8, maxLength: 128 },
    name: { type: 'string', minLength: 1, maxLength: 60 },
  },
} as const;

const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: emailSchema,
    password: { type: 'string', minLength: 1, maxLength: 128 },
  },
} as const;

// O serializer do Fastify só emite os campos declarados: mesmo que um hash
// escape para o objeto por engano, ele não sai na resposta.
const publicUserResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    streak: { type: 'integer' },
    xp: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const sessionResponseSchema = {
  type: 'object',
  properties: { token: { type: 'string' }, user: publicUserResponseSchema },
} as const;

/** Atrás do Cloudflare Tunnel o IP real do cliente vem no CF-Connecting-IP. */
function clientIp(request: FastifyRequest): string {
  const cfIp = request.headers['cf-connecting-ip'];
  return (Array.isArray(cfIp) ? cfIp[0] : cfIp) ?? request.ip;
}

export async function authRoutes(app: FastifyInstance) {
  await app.register(rateLimit, { global: false, keyGenerator: clientIp });

  // Contra força bruta: 10 tentativas a cada 15 minutos por IP
  const bruteForceLimit = { rateLimit: { max: 10, timeWindow: '15 minutes' } };

  app.post<{ Body: RegisterBody }>(
    '/register',
    {
      config: bruteForceLimit,
      schema: { body: registerBodySchema, response: { 201: sessionResponseSchema } },
    },
    AuthController.register,
  );

  app.post<{ Body: LoginBody }>(
    '/login',
    {
      config: bruteForceLimit,
      schema: { body: loginBodySchema, response: { 200: sessionResponseSchema } },
    },
    AuthController.login,
  );

  app.get(
    '/me',
    {
      onRequest: authenticate,
      schema: { response: { 200: { type: 'object', properties: { user: publicUserResponseSchema } } } },
    },
    AuthController.me,
  );
}
