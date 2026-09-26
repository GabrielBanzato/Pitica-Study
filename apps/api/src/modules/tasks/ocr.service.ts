import { createWorker } from 'tesseract.js';

export class OcrService {
  /**
   * Extrai o texto contido na imagem do print da tarefa/questão.
   * Lança erro se a imagem não puder ser lida.
   */
  public static async extractTextFromImage(imagePath: string): Promise<string> {
    const worker = await createWorker('por'); // Idioma português
    try {
      const { data } = await worker.recognize(imagePath);
      return data.text;
    } finally {
      // Sempre encerra o worker, mesmo se o reconhecimento falhar (evita vazamento de processo/memória)
      await worker.terminate();
    }
  }
}
