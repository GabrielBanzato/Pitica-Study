import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

export class UnreadableFileError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UnreadableFileError';
  }
}

export class PdfService {
  /** Extrai o texto de um PDF. Lança UnreadableFileError se o arquivo estiver corrompido ou protegido. */
  public static async extractText(pdfPath: string): Promise<string> {
    const parser = new PDFParse({ data: await readFile(pdfPath) });
    try {
      const { text } = await parser.getText();
      return text ?? '';
    } catch (err) {
      throw new UnreadableFileError('PDF corrompido, protegido por senha ou em formato não suportado.', {
        cause: err,
      });
    } finally {
      // Libera o documento carregado pelo pdf.js mesmo em caso de erro
      await parser.destroy().catch(() => undefined);
    }
  }
}
