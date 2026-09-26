import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { MultipartFile } from '@fastify/multipart';

export const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

export class FileTooLargeError extends Error {
  constructor() {
    super('Arquivo maior que o limite permitido.');
    this.name = 'FileTooLargeError';
  }
}

/** Remove caminhos e caracteres perigosos do nome enviado pelo cliente (evita path traversal). */
export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).normalize('NFC');
  const safe = base.replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^\.+/, '');
  return safe || 'arquivo';
}

/** Remove um arquivo sem nunca lançar erro (limpeza best-effort). */
export async function removeQuietly(filePath: string): Promise<void> {
  await unlink(filePath).catch(() => undefined);
}

/**
 * Grava o upload em `uploads/<subdir>` via stream (sem carregar o arquivo na memória).
 * Arquivos cortados pelo limite do multipart são descartados em vez de salvos pela metade.
 */
export async function saveUpload(file: MultipartFile, subdir: string): Promise<string> {
  const dir = path.join(UPLOADS_ROOT, subdir);
  await mkdir(dir, { recursive: true });

  const savePath = path.join(dir, `${Date.now()}-${sanitizeFilename(file.filename)}`);

  try {
    await pipeline(file.file, createWriteStream(savePath));
  } catch (err) {
    await removeQuietly(savePath);
    throw err;
  }

  if (file.file.truncated) {
    await removeQuietly(savePath);
    throw new FileTooLargeError();
  }

  return savePath;
}
