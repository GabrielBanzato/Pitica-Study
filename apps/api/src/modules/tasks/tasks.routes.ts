import { FastifyInstance } from 'fastify';
import { ensureSubject, prisma } from '../../lib/prisma.js';
import { FileTooLargeError, saveUpload } from '../../lib/uploads.js';
import { AiProviderError } from '../ai/gemini.provider.js';
import { QuestionGeneratorService } from '../ai/question-generator.service.js';
import { OcrService } from './ocr.service.js';
import { PdfService, UnreadableFileError } from './pdf.service.js';

interface TaskUploadResponse {
  message: string;
  taskId: string;
  topicName: string;
  questionsCreated: number;
}

interface ErrorResponse {
  error: string;
}

export async function tasksRoutes(app: FastifyInstance) {
  app.post<{ Reply: TaskUploadResponse | ErrorResponse }>('/upload', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'Nenhum arquivo recebido! 😅' });
    }

    const isPdf = file.mimetype === 'application/pdf' || file.filename.toLowerCase().endsWith('.pdf');

    try {
      const savePath = await saveUpload(file, 'tasks');

      request.log.info({ file: file.filename, isPdf }, 'Extraindo texto do arquivo de tarefa');
      const extractedText = (
        isPdf ? await PdfService.extractText(savePath) : await OcrService.extractTextFromImage(savePath)
      ).trim();

      if (!extractedText) {
        return reply.status(422).send({
          error: isPdf
            ? 'Não encontrei texto nesse PDF (pode ser um PDF só de imagens). 📄'
            : 'Não consegui ler nenhum texto nesse print. Tenta uma imagem mais nítida? 📸',
        });
      }

      const subject = await ensureSubject();
      const [task, generation] = await Promise.all([
        prisma.task.create({ data: { subjectId: subject.id, imagePath: savePath, rawText: extractedText } }),
        QuestionGeneratorService.processAndGenerateQuestions({ content: extractedText, subjectId: subject.id }),
      ]);

      return {
        message: isPdf
          ? `Resumo PDF processado! ${generation.questionsCreated} novas questões na Prática Diária! 📄✨`
          : `Print processado! ${generation.questionsCreated} novas questões adicionadas! 📸✨`,
        taskId: task.id,
        topicName: generation.topicName,
        questionsCreated: generation.questionsCreated,
      };
    } catch (err) {
      if (err instanceof FileTooLargeError) {
        return reply.status(413).send({ error: 'Arquivo grande demais! 😅' });
      }
      if (err instanceof UnreadableFileError) {
        return reply.status(422).send({ error: err.message });
      }
      if (err instanceof AiProviderError) {
        request.log.error({ err }, 'Falha ao gerar questões no Gemini');
        return reply.status(502).send({ error: 'A Sun não conseguiu gerar as questões agora. Tenta de novo daqui a pouco! 🌻' });
      }
      request.log.error({ err }, 'Erro ao processar o arquivo de tarefa');
      return reply.status(500).send({ error: 'Falha ao processar o arquivo.' });
    }
  });
}
