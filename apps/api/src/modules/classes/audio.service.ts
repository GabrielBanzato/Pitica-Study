import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export class AudioService {
  /**
   * Extrai o áudio do vídeo da aula e converte para .wav (16kHz mono, ideal para transcrição via STT)
   */
  public static async extractAudio(videoPath: string): Promise<string> {
    const outputPath = videoPath.replace(path.extname(videoPath), '.wav');

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vn',               // Remove a trilha de vídeo
          '-acodec pcm_s16le', // Codec de áudio WAV não compactado
          '-ar 16000',         // Sample rate de 16kHz (padrão para Whisper/STT)
          '-ac 1'              // Áudio Mono
        ])
        .save(outputPath)
        .on('end', () => {
          console.log(`🎙️ Áudio da aula extraído com sucesso: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Erro na extração de áudio via FFmpeg:', err);
          reject(err);
        });
    });
  }
}