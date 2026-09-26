import { readFile } from 'node:fs/promises';
import { WaveFile } from 'wavefile';

type Transcriber = (
  audio: Float32Array | Float64Array,
  options: Record<string, unknown>,
) => Promise<{ text?: string } | Array<{ text?: string }>>;

interface TransformersModule {
  pipeline: (task: 'automatic-speech-recognition', model: string) => Promise<Transcriber>;
}

// Import dinâmico preservado: @xenova/transformers é ESM-only e a API compila em CommonJS
const loadTransformers = () => eval(`import('@xenova/transformers')`) as Promise<TransformersModule>;

let transcriberPromise: Promise<Transcriber> | null = null;

/** Carrega o modelo uma única vez e reaproveita entre as aulas. */
function getTranscriber(): Promise<Transcriber> {
  transcriberPromise ??= loadTransformers()
    .then(({ pipeline }) => pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny'))
    .catch((err: unknown) => {
      transcriberPromise = null; // permite nova tentativa na próxima aula
      throw err;
    });
  return transcriberPromise;
}

/** Lê o WAV como amostras Float32 em 16 kHz (no Node o transformers.js não decodifica arquivos sozinho). */
async function readAudioSamples(audioPath: string): Promise<Float32Array | Float64Array> {
  const wav = new WaveFile(await readFile(audioPath));
  wav.toBitDepth('32f');
  wav.toSampleRate(16000);

  const samples: unknown = wav.getSamples();
  // Áudio com mais de um canal vem como array de canais: usa o primeiro
  if (Array.isArray(samples)) return samples[0] as Float64Array;
  return samples as Float64Array;
}

export class WhisperService {
  /** Transcreve o áudio da aula. Lança erro se falhar (nunca devolve texto inventado). */
  public static async transcribeAudio(audioPath: string): Promise<string> {
    const [transcriber, audio] = await Promise.all([getTranscriber(), readAudioSamples(audioPath)]);

    const result = await transcriber(audio, {
      language: 'portuguese',
      task: 'transcribe',
      // Sem chunking o Whisper só transcreve os primeiros 30 segundos
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const text = (Array.isArray(result) ? result[0]?.text : result.text)?.trim() ?? '';
    if (!text) {
      throw new Error('A transcrição do áudio voltou vazia.');
    }
    return text;
  }
}
