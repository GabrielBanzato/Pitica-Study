import { PrismaClient } from '@prisma/client';

// Instância única: cada `new PrismaClient()` abre o próprio pool de conexões.
export const prisma = new PrismaClient();

/** Disciplina informada ou, na falta dela, a disciplina padrão (criada se não existir). */
export async function ensureSubject(subjectId?: string) {
  if (subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (subject) return subject;
  }

  return (
    (await prisma.subject.findFirst({ orderBy: { createdAt: 'asc' } })) ??
    (await prisma.subject.create({ data: { name: 'Nutrição Base' } }))
  );
}
