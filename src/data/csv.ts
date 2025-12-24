import Papa from 'papaparse';
import { ValidationError } from '../utils/errors';
import { validateColumns } from './schema';

async function fileFromHandle(handle: FileSystemFileHandle | File): Promise<File> {
  if (handle instanceof File) return handle;
  return handle.getFile();
}

export async function parseCsvFile<T = Record<string, string | number>>(handle: FileSystemFileHandle | File) {
  const file = await fileFromHandle(handle);
  return new Promise<T[]>((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve(result.data);
      },
      error: (err) => reject(err),
    });
  });
}

export async function parseWithSchema<T>(handle: FileSystemFileHandle | File, required: string[]) {
  const rows = await parseCsvFile<Record<string, unknown>>(handle);
  const missing = validateColumns(Object.keys(rows[0] ?? {}), required);
  if (missing.length) throw new ValidationError(`Colonnes manquantes: ${missing.join(', ')}`);
  return rows as unknown as T[];
}
