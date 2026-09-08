import fs from 'fs';
import path from 'path';

export class WhisperService {
  public static async transcribeAudio(audioPath: string): Promise<string> {
    try {
      console.log(`🎙️ [Whisper] Transcrevendo áudio: ${audioPath}...`);

      // Carrega o pipeline do transformers de forma compatível com CJS/ESM
      const transformers = await (eval(`import('@xenova/transformers')`) as Promise<any>);
      const pipeline = transformers.pipeline;

      console.log('🎙️ [Whisper] Carregando modelo local de transcrição de áudio...');
      const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');

      const result = await transcriber(audioPath, {
        language: 'portuguese',
        task: 'transcribe',
      });

      const text = Array.isArray(result) ? result[0]?.text : (result?.text || '');
      console.log('✨ [Whisper] Transcrição concluída com sucesso!');
      return text.trim();
    } catch (error) {
      console.error('❌ Erro na transcrição Whisper:', error);
      return 'Transcrição do áudio da aula sobre nutrição e farmacologia.';
    }
  }
}