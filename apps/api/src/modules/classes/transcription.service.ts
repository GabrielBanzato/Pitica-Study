import { PrismaClient } from '@prisma/client';
import { QwenProvider } from '../ai/qwen.provider.js';
import { QuestionGeneratorService } from '../ai/question-generator.service.js';
import { WhisperService } from './whisper.service.js';

const prisma = new PrismaClient();

export class TranscriptionService {
  public static async processClassAudio(classId: string, audioPath: string, isReanalysis = false) {
    try {
      console.log(`🌻 [Sunfl.IA.wer] Transcrevendo aula ID: ${classId} (Reanálise: ${isReanalysis})...`);

      await prisma.class.update({
        where: { id: classId },
        data: { status: 'ANALYZING' }
      });

      const realTranscript = await WhisperService.transcribeAudio(audioPath);

      const existingTopics = await prisma.topic.findMany({
        where: { classId },
        select: { name: true }
      });

      const existingNames = existingTopics.map(t => t.name).join(', ');

      const prompt = `
Você é a Sunfl.IA.wer 🌻, tutora inteligente de estudos de Nutrição da Lê.
Analise a transcrição abaixo e extraia tópicos e subtópicos explicados pelo professor.

${isReanalysis && existingNames ? `ATENÇÃO: Os seguintes tópicos JÁ FORAM MAPEADOS: [${existingNames}]. Identifique apenas SUBTÓPICOS NOVOS ou DETALHES que ficaram de fora.` : ''}

TRANSCRIÇÃO REAL DA AULA:
"${realTranscript.substring(0, 4000)}"

Retorne APENAS um JSON válido no formato estrito abaixo (TODOS OS CAMPOS SÃO OBRIGATÓRIOS):
{
  "title": "Título Resumido da Aula",
  "summary": "Resumo geral da aula em 2 parágrafos.",
  "topics": [
    {
      "name": "Nome do Tópico",
      "fashionSummary": "Sinopse em 1 frase fashion ✨",
      "fashionText": "Explicação completa utilizando analogias do universo da moda e passarelas.",
      "academicSummary": "Sinopse científica em 1 frase 🔬",
      "academicText": "Explicação técnica detalhada com linguagem acadêmica, porém meiga e acessível."
    }
  ]
}
`;

      const responseText = await QwenProvider.analyzeClassTranscript(prompt);
      
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(responseText.substring(jsonStart, jsonEnd));

        await prisma.class.update({
          where: { id: classId },
          data: {
            title: parsed.title || 'Aula de Nutrição',
            transcript: parsed.summary || realTranscript,
            status: 'COMPLETED'
          }
        });

        for (const t of parsed.topics || []) {
          // Trata e garante fallbacks para nenhum campo ficar como null no banco
          const fText = t.fashionText || t.academicText || 'Explicação do tópico em elaboração.';
          const aText = t.academicText || t.fashionText || 'Explicação acadêmica do tópico.';
          const fSummary = t.fashionSummary || (fText.length > 90 ? fText.substring(0, 90) + '...' : fText);
          const aSummary = t.academicSummary || (aText.length > 90 ? aText.substring(0, 90) + '...' : aText);

          const exists = await prisma.topic.findFirst({
            where: { classId, name: t.name }
          });

          if (!exists) {
            await prisma.topic.create({
              data: {
                classId,
                name: t.name,
                summary: aSummary,
                fashionSummary: fSummary,
                fashionText: fText,
                academicSummary: aSummary,
                academicText: aText
              }
            });

            await QuestionGeneratorService.processAndGenerateQuestions(
              `${t.name}: ${aText}`,
              classId
            );
          }
        }

        console.log(`✨ [Sunfl.IA.wer] Aula "${parsed.title}" processada com sucesso!`);
      } else {
        await prisma.class.update({
          where: { id: classId },
          data: { status: 'COMPLETED', transcript: realTranscript }
        });
      }
    } catch (err) {
      console.error('❌ Erro no processamento da aula:', err);
      await prisma.class.update({
        where: { id: classId },
        data: { status: 'FAILED' }
      });
    }
  }
}