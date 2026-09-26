import { prisma } from '../../lib/prisma.js';
import { removeQuietly } from '../../lib/uploads.js';
import { GeminiProvider } from '../ai/gemini.provider.js';
import { QuestionGeneratorService, SUN_SYSTEM_INSTRUCTION } from '../ai/question-generator.service.js';
import { isNonEmptyString, isRecord } from '../ai/question.schema.js';
import { AudioService } from './audio.service.js';
import { WhisperService } from './whisper.service.js';

/** Limite da transcrição enviada ao Gemini (~1h de aula). */
const MAX_TRANSCRIPT_CHARS = 60_000;

interface AnalyzedTopic {
  name: string;
  fashionSummary: string;
  fashionText: string;
  academicSummary: string;
  academicText: string;
}

interface ClassAnalysis {
  title: string;
  summary: string;
  topics: AnalyzedTopic[];
}

const topicFields = ['name', 'fashionSummary', 'fashionText', 'academicSummary', 'academicText'] as const;

const classAnalysisJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: Object.fromEntries(topicFields.map((field) => [field, { type: 'string' }])),
        required: [...topicFields],
      },
    },
  },
  required: ['title', 'summary', 'topics'],
};

const summarize = (text: string) => (text.length > 90 ? `${text.slice(0, 90)}...` : text);

/** Normaliza o JSON do Gemini garantindo que nenhum campo de tópico fique vazio no banco. */
function parseClassAnalysis(raw: unknown): ClassAnalysis | null {
  if (!isRecord(raw) || !Array.isArray(raw.topics)) return null;

  const topics = raw.topics.filter(isRecord).flatMap((t): AnalyzedTopic[] => {
    if (!isNonEmptyString(t.name)) return [];
    const text = (value: unknown) => (isNonEmptyString(value) ? value.trim() : '');

    const fashionText = text(t.fashionText) || text(t.academicText) || 'Explicação do tópico em elaboração.';
    const academicText = text(t.academicText) || text(t.fashionText) || 'Explicação acadêmica do tópico.';
    return [{
      name: t.name.trim(),
      fashionText,
      academicText,
      fashionSummary: text(t.fashionSummary) || summarize(fashionText),
      academicSummary: text(t.academicSummary) || summarize(academicText),
    }];
  });

  return {
    title: isNonEmptyString(raw.title) ? raw.title.trim() : 'Aula de Nutrição',
    summary: isNonEmptyString(raw.summary) ? raw.summary.trim() : '',
    topics,
  };
}

function buildPrompt(transcript: string, existingNames: string[]): string {
  const reanalysisHint = existingNames.length
    ? `ATENÇÃO: Os seguintes tópicos JÁ FORAM MAPEADOS: [${existingNames.join(', ')}]. Identifique apenas SUBTÓPICOS NOVOS ou DETALHES que ficaram de fora.`
    : '';

  return `
Analise a transcrição abaixo e extraia tópicos e subtópicos explicados pelo professor.
${reanalysisHint}

Para cada tópico:
- "fashionSummary": sinopse em 1 frase fashion ✨
- "fashionText": explicação completa utilizando analogias do universo da moda e passarelas
- "academicSummary": sinopse científica em 1 frase 🔬
- "academicText": explicação técnica detalhada com linguagem acadêmica, porém meiga e acessível

"title" é um título resumido da aula e "summary" um resumo geral em 2 parágrafos.

TRANSCRIÇÃO REAL DA AULA:
"""
${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}
"""
`;
}

export class TranscriptionService {
  /**
   * Pipeline completo em segundo plano: vídeo → áudio → transcrição → tópicos → questões.
   * Nunca rejeita: qualquer falha marca a aula como FAILED.
   */
  public static async processClassVideo(classId: string, videoPath: string, isReanalysis: boolean): Promise<void> {
    let audioPath: string | undefined;
    try {
      await prisma.class.update({ where: { id: classId }, data: { status: 'PROCESSING' } });
      audioPath = await AudioService.extractAudio(videoPath);
      await this.processClassAudio(classId, audioPath, isReanalysis);
    } catch (err) {
      console.error(`❌ Erro no processamento da aula ${classId}:`, err);
      await prisma.class
        .update({ where: { id: classId }, data: { status: 'FAILED' } })
        .catch((updateErr: unknown) => console.error('❌ Não foi possível marcar a aula como FAILED:', updateErr));
    } finally {
      // O .wav é só intermediário; o vídeo original fica para reanálises
      if (audioPath) await removeQuietly(audioPath);
    }
  }

  private static async processClassAudio(classId: string, audioPath: string, isReanalysis: boolean): Promise<void> {
    console.log(`🌻 [Sunfl.IA.wer] Transcrevendo aula ID: ${classId} (Reanálise: ${isReanalysis})...`);

    const [, transcript, existingTopics] = await Promise.all([
      prisma.class.update({ where: { id: classId }, data: { status: 'ANALYZING' } }),
      WhisperService.transcribeAudio(audioPath),
      prisma.topic.findMany({ where: { classId }, select: { name: true } }),
    ]);

    const existingNames = existingTopics.map((t) => t.name);
    const analysis = await GeminiProvider.generateJson(
      buildPrompt(transcript, isReanalysis ? existingNames : []),
      { systemInstruction: SUN_SYSTEM_INSTRUCTION, schema: classAnalysisJsonSchema, parse: parseClassAnalysis },
    );

    // Descarta tópicos já existentes e repetidos na própria resposta (comparação sem maiúsculas/espaços)
    const seen = new Set(existingNames.map((name) => name.toLowerCase().trim()));
    const newTopics = analysis.topics.filter((t) => {
      const key = t.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const createdTopics = await prisma.$transaction(
      newTopics.map((t) =>
        prisma.topic.create({
          data: { classId, ...t, summary: t.academicSummary },
          select: { id: true, name: true, academicText: true },
        }),
      ),
    );

    // Questões de todos os tópicos geradas em paralelo; a falha de um não derruba os outros
    const results = await Promise.allSettled(
      createdTopics.map((topic) =>
        QuestionGeneratorService.processAndGenerateQuestions({
          content: `${topic.name}: ${topic.academicText ?? ''}`,
          topicId: topic.id,
        }),
      ),
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`⚠️ Falha ao gerar questões do tópico "${createdTopics[i].name}":`, result.reason);
      }
    });

    await prisma.class.update({
      where: { id: classId },
      data: {
        title: analysis.title,
        transcript: analysis.summary || transcript,
        status: 'COMPLETED',
      },
    });

    console.log(`✨ [Sunfl.IA.wer] Aula "${analysis.title}" processada: ${createdTopics.length} novos tópicos.`);
  }
}
