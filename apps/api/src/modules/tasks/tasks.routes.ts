import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import { PDFParse } from 'pdf-parse';
import { QuestionGeneratorService } from '../ai/question-generator.service.js';
import { OcrService } from './ocr.service.js';

const pump = util.promisify(pipeline);

export async function tasksRoutes(app: FastifyInstance) {
  app.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Nenhum arquivo recebido! 😅' });
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'tasks');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}-${data.filename}`;
    const savePath = path.join(uploadDir, filename);
    await pump(data.file, fs.createWriteStream(savePath));

    let extractedText = '';

    try {
      const isPdf = data.filename.toLowerCase().endsWith('.pdf') || data.mimetype === 'application/pdf';

      if (isPdf) {
        console.log(`📄 [PDF Parser] Lendo documento PDF: ${data.filename}...`);
        const dataBuffer = fs.readFileSync(savePath);

        const parser = new PDFParse({ data: dataBuffer });
        const parsedPdf = await parser.getText();
        await parser.destroy();
        extractedText = parsedPdf.text || '';
        console.log(`✨ [PDF Parser] Texto extraído com sucesso (${extractedText.length} caracteres)!`);
      } else {
        console.log(`📸 [OCR Image] Processando imagem do print: ${data.filename}...`);
        extractedText = await OcrService.extractTextFromImage(savePath);
        console.log(`✨ [OCR Image] Texto extraído com sucesso (${extractedText.length} caracteres)!`);
      }

      if (extractedText.trim().length > 0) {
        await QuestionGeneratorService.processAndGenerateQuestions(extractedText);
      }

      return {
        message: isPdf 
          ? 'Resumo PDF processado! Novas questões foram geradas para a Prática Diária! 📄✨'
          : 'Print processado com sucesso! Novas questões adicionadas! 📸✨'
      };
    } catch (err) {
      console.error('❌ Erro ao processar o arquivo de tarefas/resumo:', err);
      return reply.status(500).send({ error: 'Falha ao ler o conteúdo do arquivo.' });
    }
  });
}