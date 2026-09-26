import { FastifyInstance } from 'fastify';
import path from 'node:path';
import { ensureSubject, prisma } from '../../lib/prisma.js';
import { FileTooLargeError, sanitizeFilename, saveUpload } from '../../lib/uploads.js';
import { GeminiProvider } from '../ai/gemini.provider.js';
import { SUN_SYSTEM_INSTRUCTION } from '../ai/question-generator.service.js';
import { TranscriptionService } from './transcription.service.js';

interface ChatBody {
  topicName: string;
  topicContext?: string;
  userQuestion: string;
}

interface ChatFeedbackBody {
  topicName?: string;
  userQuestion?: string;
  aiAnswer?: string;
  feedback: 'util' | 'inutil';
}

const chatBodySchema = {
  type: 'object',
  required: ['topicName', 'userQuestion'],
  properties: {
    topicName: { type: 'string', minLength: 1 },
    topicContext: { type: 'string' },
    userQuestion: { type: 'string', minLength: 1, maxLength: 4000 },
  },
} as const;

const chatFeedbackBodySchema = {
  type: 'object',
  required: ['feedback'],
  properties: {
    topicName: { type: 'string' },
    userQuestion: { type: 'string' },
    aiAnswer: { type: 'string' },
    feedback: { type: 'string', enum: ['util', 'inutil'] },
  },
} as const;

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

/** Dispara o processamento da aula sem bloquear a resposta HTTP (o pipeline nunca rejeita). */
function processInBackground(classId: string, videoPath: string, isReanalysis: boolean) {
  void TranscriptionService.processClassVideo(classId, videoPath, isReanalysis);
}

export async function classesRoutes(app: FastifyInstance) {

  // 1. Listar todas as aulas
  app.get('/', async () => {
    return prisma.class.findMany({
      include: { topics: true },
      orderBy: { createdAt: 'desc' }
    });
  });

  // 2. Glossário de Tópicos (sem nomes repetidos, mantendo o mais recente)
  app.get('/topics', async () => {
    const topics = await prisma.topic.findMany({ orderBy: { createdAt: 'desc' } });

    const unique = new Map<string, (typeof topics)[number]>();
    for (const topic of topics) {
      const key = topic.name.toLowerCase().trim();
      if (!unique.has(key)) unique.set(key, topic);
    }
    return [...unique.values()];
  });

  // 3. Chat da Sun 🌻
  app.post<{ Body: ChatBody }>('/topics/chat', { schema: { body: chatBodySchema } }, async (request) => {
    const { topicName, topicContext, userQuestion } = request.body;

    const prompt = `Responda à aluna de forma meiga, direta e cientificamente correta.

Tópico: ${topicName}
Contexto: ${topicContext ?? ''}
Pergunta da Lê: "${userQuestion}"

Regras:
1. Responda diretamente à dúvida na primeira frase.
2. Explique o conceito fisiológico/farmacológico real sem usar analogias de moda (vestidos, passarelas, etc.).
3. Escreva em 2 parágrafos curtos em texto corrido.
4. Não inclua títulos, rótulos, graus ou opções de resposta.`;

    try {
      const answer = await GeminiProvider.generateText(prompt, {
        systemInstruction: `${SUN_SYSTEM_INSTRUCTION} Você é tutora virtual de Nutrição e Farmacologia.`,
      });
      return { answer };
    } catch (err) {
      request.log.error({ err }, 'Erro no chat da Sun');
      return { answer: 'Tive um pequeno probleminha no meu jardim agora! 🌻 Pode perguntar de novo, Lê?' };
    }
  });

  // 4. Registro de Feedback de utilidade
  app.post<{ Body: ChatFeedbackBody }>(
    '/topics/chat/feedback',
    { schema: { body: chatFeedbackBodySchema } },
    async (request) => {
      const { topicName, userQuestion, feedback } = request.body;
      request.log.info({ feedback, topicName, userQuestion }, '📊 Feedback da Sun');
      return { success: true, message: 'Feedback registrado com sucesso! 🌻' };
    },
  );

  // 5. Reanalisar aula existente
  app.post<{ Params: { id: string } }>(
    '/reanalyze/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const { id } = request.params;
      const classData = await prisma.class.findUnique({ where: { id } });

      if (!classData?.videoPath) {
        return reply.status(404).send({ error: 'Aula não encontrada.' });
      }

      processInBackground(id, classData.videoPath, true);
      return { message: 'Reanalisando a aula em busca de novos subtópicos! 🔍✨' };
    },
  );

  // 6. Upload de novas aulas
  app.post('/upload', async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: 'Nenhum arquivo recebido! 😅' });

    // O título é trocado pelo gerado pela IA; a duplicidade é checada pelo nome salvo no disco (<timestamp>-<nome>)
    const safeName = sanitizeFilename(file.filename);
    const candidates = await prisma.class.findMany({
      where: { videoPath: { endsWith: `-${safeName}` } },
      select: { id: true, videoPath: true },
    });
    const existingClass = candidates.find(
      (c) => c.videoPath && path.basename(c.videoPath).replace(/^\d+-/, '') === safeName,
    );
    if (existingClass) {
      file.file.resume(); // descarta o restante do upload para liberar a requisição
      return {
        message: 'Esta aula já foi enviada anteriormente! Para buscar novos subtópicos, use o botão "Analisar Novamente". 🎥✨',
        classId: existingClass.id
      };
    }

    let savePath: string;
    try {
      savePath = await saveUpload(file, 'classes');
    } catch (err) {
      if (err instanceof FileTooLargeError) {
        return reply.status(413).send({ error: 'Vídeo grande demais! O limite é 500 MB. 😅' });
      }
      throw err;
    }

    const subject = await ensureSubject();
    const newClass = await prisma.class.create({
      data: {
        title: file.filename,
        subjectId: subject.id,
        videoPath: savePath,
        status: 'PROCESSING'
      }
    });

    processInBackground(newClass.id, savePath, false);
    return { message: 'Aula recebida! A Sunfl.IA.wer já está preparando os tópicos pra você! 🎥✨', classId: newClass.id };
  });
}
