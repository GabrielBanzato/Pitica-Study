import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'node:path';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export class AudioService {
  /**
   * Extrai o áudio do vídeo da aula e converte para .wav (16kHz mono, ideal para transcrição via STT)
   */
  public static async extractAudio(videoPath: string): Promise<string> {
    const { dir, name } = path.parse(videoPath);
    const outputPath = path.join(dir, `${name}.wav`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vn',               // Remove a trilha de vídeo
          '-acodec pcm_s16le', // Codec de áudio WAV não compactado
          '-ar 16000',         // Sample rate de 16kHz (padrão para Whisper/STT)
          '-ac 1'              // Áudio Mono
        ])
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .save(outputPath);
    });
  }
}
