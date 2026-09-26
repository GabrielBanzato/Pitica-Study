import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** Campos do usuário que podem sair da API — o hash da senha nunca entra aqui. */
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  streak: true,
  xp: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export class EmailAlreadyInUseError extends Error {
  constructor() {
    super('E-mail já cadastrado.');
    this.name = 'EmailAlreadyInUseError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('E-mail ou senha inválidos.');
    this.name = 'InvalidCredentialsError';
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Hash de referência para e-mails inexistentes: o login leva o mesmo tempo
// com ou sem conta, o que impede descobrir quais e-mails estão cadastrados.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= argon2.hash('pitica-study-dummy-password'));

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // hash malformado (ex.: contas antigas sem senha)
  }
}

export class AuthService {
  public static async register(input: RegisterInput): Promise<PublicUser> {
    const password = await argon2.hash(input.password, { type: argon2.argon2id });

    try {
      return await prisma.user.create({
        data: {
          email: normalizeEmail(input.email),
          password,
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        },
        select: publicUserSelect,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new EmailAlreadyInUseError();
      }
      throw err;
    }
  }

  public static async login(email: string, password: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { ...publicUserSelect, password: true },
    });

    if (!user) {
      await verifyPassword(await getDummyHash(), password);
      throw new InvalidCredentialsError();
    }

    const { password: passwordHash, ...publicUser } = user;
    if (!(await verifyPassword(passwordHash, password))) {
      throw new InvalidCredentialsError();
    }
    return publicUser;
  }

  public static async findById(id: string): Promise<PublicUser | null> {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  }
}
