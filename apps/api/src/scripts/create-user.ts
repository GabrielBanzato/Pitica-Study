/**
 * Cria um usuário (ou redefine a senha, se o e-mail já existir) sem passar pela tela de cadastro.
 *
 * Uso:  npm run user:create -- <email> <senha> [nome]
 * No container:  docker exec -it pitica_api npx tsx src/scripts/create-user.ts <email> <senha> [nome]
 */
import 'dotenv/config';
import argon2 from 'argon2';
import { prisma } from '../lib/prisma.js';

const MIN_PASSWORD = 8;

async function main() {
  const [rawEmail, password, name] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();

  if (!email || !password) {
    throw new Error('Uso: npm run user:create -- <email> <senha> [nome]');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`E-mail inválido: ${email}`);
  }
  if (password.length < MIN_PASSWORD) {
    throw new Error(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
  }

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, password: hash, ...(name ? { name } : {}) },
    update: { password: hash, ...(name ? { name } : {}) },
    select: { id: true, email: true, name: true },
  });

  console.log(`✅ Usuário ${existing ? 'atualizado (senha redefinida)' : 'criado'}: ${user.email} (${user.name}) — id ${user.id}`);
}

main()
  .catch((err: unknown) => {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
