import type { FastifyReply, FastifyRequest } from 'fastify';

/** Conteúdo do JWT emitido no login/cadastro. */
export interface AuthTokenPayload {
  sub: string; // id do usuário
  email: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

/**
 * Hook de proteção: exige `Authorization: Bearer <token>` válido.
 * Usado em `onRequest`, então roda antes do corpo ser lido (uploads sem token
 * são recusados sem receber o arquivo).
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}
