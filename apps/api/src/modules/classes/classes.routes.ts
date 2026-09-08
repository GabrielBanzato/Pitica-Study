import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import { PrismaClient } from '@prisma/client';
import { AudioService } from './audio.service.js';
import { TranscriptionService } from './transcription.service.js';
import { QwenProvider } from '../ai/qwen.provider.js';

const pump = util.promisify(pipeline);
const prisma = new PrismaClient();

export async function classesRoutes(app: FastifyInstance) {
  
  // 1. Listar todas as aulas
  app.get('/', async (request, reply) => {
    const classes = await prisma.class.findMany({
      include: { topics: true },
      orderBy: { createdAt: 'desc' }
    });
    return classes;
  });

  // 2. Glossário de Tópicos (sem nomes repetidos)
  app.get('/topics', async (request, reply) => {
    const topics = await prisma.topic.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const uniqueTopics = topics.filter((topic, index, self) =>
      index === self.findIndex((t) => t.name.toLowerCase().trim() === topic.name.toLowerCase().trim())
    );

    return uniqueTopics;
  });

// Chat da Sun 🌻 com Higienização de Saída
  app.post('/topics/chat', async (request, reply) => {
    const { topicName, topicContext, userQuestion } = request.body as any;

    const prompt = `Você é a Sun 🌻, tutora virtual de Nutrição e Farmacologia da Lê. Responda à aluna de forma meiga, direta e cientificamente correta.

Tópico: ${topicName}
Contexto: ${topicContext}
Pergunta da Lê: "${userQuestion}"

Regras:
1. Responda diretamente à dúvida na primeira frase.
2. Explique o conceito fisiológico/farmacológico real sem usar analogias de moda (vestidos, passarelas, etc.).
3. Escreva em 2 parágrafos curtos em texto corrido.
4. Não inclua títulos, rótulos, graus ou opções de resposta.`;

    try {
      let answer = await QwenProvider.analyzeClassTranscript(prompt);

      // Trava Anti-Vazamento: remove resquícios do prompt se o modelo tentar copiar
      if (answer.includes('INSTRUÇÃO DE SISTEMA:')) {
        answer = answer.split('INSTRUÇÃO DE SISTEMA:')[0];
      }
      answer = answer
        .replace(/\*\*GRAU \d+:\*\*/g, '')
        .replace(/INSTRUÇÃO DE SISTEMA:?/gi, '')
        .replace(/DÚVIDA DA LÊ:?/gi, '')
        .replace(/RESPOSTA:?/gi, '')
        .trim();

    return { answer };
    } catch (err) {
      console.error('Erro no chat da Sun:', err);
      return { answer: 'Tive um pequeno probleminha no meu jardim agora! 🌻 Pode perguntar de novo, Lê?' };
    }
  });

  // 4. Registro de Feedback de utilidade
  app.post('/topics/chat/feedback', async (request, reply) => {
    const { topicName, userQuestion, aiAnswer, feedback } = request.body as any;
    console.log(`📊 [Sun Feedback - ${feedback?.toUpperCase()}] Tópico: ${topicName} | Pergunta: ${userQuestion}`);
    return { success: true, message: 'Feedback registrado com sucesso! 🌻' };
  });

  // 5. Reanalisar aula existente
  app.post('/reanalyze/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const classData = await prisma.class.findUnique({ where: { id } });

    if (!classData || !classData.videoPath) {
      return reply.status(404).send({ error: 'Aula não encontrada.' });
    }

    AudioService.extractAudio(classData.videoPath)
      .then(async (audioPath) => {
        await TranscriptionService.processClassAudio(id, audioPath, true);
      })
      .catch(async () => {
        await prisma.class.update({ where: { id }, data: { status: 'FAILED' } });
      });

    return { message: 'Reanalisando a aula em busca de novos subtópicos! 🔍✨' };
  });

  // 6. Upload de novas aulas
  app.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo recebido! 😅' });

    const existingClass = await prisma.class.findFirst({ where: { title: data.filename } });
    if (existingClass) {
      return reply.status(200).send({
        message: 'Esta aula já foi enviada anteriormente! Para buscar novos subtópicos, use o botão "Analisar Novamente". 🎥✨',
        classId: existingClass.id
      });
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'classes');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${data.filename}`;
    const savePath = path.join(uploadDir, filename);
    await pump(data.file, fs.createWriteStream(savePath));

    let subject = await prisma.subject.findFirst();
    if (!subject) subject = await prisma.subject.create({ data: { name: 'Nutrição Base' } });

    const newClass = await prisma.class.create({
      data: {
        title: data.filename,
        subjectId: subject.id,
        videoPath: savePath,
        status: 'PROCESSING'
      }
    });

    AudioService.extractAudio(savePath)
      .then(async (audioPath) => {
        await TranscriptionService.processClassAudio(newClass.id, audioPath, false);
      })
      .catch(async () => {
        await prisma.class.update({ where: { id: newClass.id }, data: { status: 'FAILED' } });
      });

    return { message: 'Aula recebida! A Sunfl.IA.wer já está preparando os tópicos pra você! 🎥✨', classId: newClass.id };
  });
}