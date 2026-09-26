import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import {
  AuthService,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  PublicUser,
  RegisterInput,
} from './auth.service.js';

export type RegisterBody = RegisterInput;

export interface LoginBody {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

async function issueSession(reply: FastifyReply, user: PublicUser): Promise<AuthResponse> {
  const token = await reply.jwtSign({ sub: user.id, email: user.email });
  return { token, user };
}

export class AuthController {
  public static async register(request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) {
    if (!env.allowRegistration) {
      return reply.status(403).send({ error: 'O cadastro de novas contas está desativado.' });
    }

    try {
      const user = await AuthService.register(request.body);
      return reply.status(201).send(await issueSession(reply, user));
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError) {
        return reply.status(409).send({ error: 'Este e-mail já está cadastrado.' });
      }
      throw err;
    }
  }

  public static async login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    try {
      const user = await AuthService.login(request.body.email, request.body.password);
      return await issueSession(reply, user);
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: err.message });
      }
      throw err;
    }
  }

  public static async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await AuthService.findById(request.user.sub);
    if (!user) {
      return reply.status(401).send({ error: 'Conta não encontrada. Faça login novamente.' });
    }
    return { user };
  }
}
