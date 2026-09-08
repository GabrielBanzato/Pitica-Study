import { createWorker } from 'tesseract.js';

export class OcrService {
  /**
   * Extrai o texto contido na imagem do print da tarefa/questão
   */
  public static async extractTextFromImage(imagePath: string): Promise<string> {
    try {
      const worker = await createWorker('por'); // Idioma português
      const { data: { text } } = await worker.recognize(imagePath);
      await worker.terminate();
      console.log('📸 Texto extraído do print via OCR com sucesso!');
      return text;
    } catch (err) {
      console.error('❌ Erro no processamento de OCR:', err);
      return '';
    }
  }
}