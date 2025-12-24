import Papa from 'papaparse';
import { ValidationError } from '../utils/errors';
import { validateColumns } from './schema';

async function fileFromHandle(handle: FileSystemFileHandle | File): Promise<File> {
  if (handle instanceof File) return handle;
  return handle.getFile();
}

export function detectDelimiter(textOrFirstLine: string) {
  const [line] = textOrFirstLine.split(/\r?\n/);
  const commaCount = (line.match(/,/g) ?? []).length;
  const semicolonCount = (line.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

export async function parseCsvFileWithMeta<T = Record<string, string | number>>(
  handle: FileSystemFileHandle | File
) {
  const file = await fileFromHandle(handle);
  const text = await file.text();
  const delimiter = detectDelimiter(text);
  return new Promise<{ rows: T[]; delimiter: string }>((resolve, reject) => {
    Papa.parse<T>(text, {
      delimiter,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve({ rows: result.data, delimiter });
      },
      error: (err) => reject(err),
    });
  });
}

export async function parseCsvFile<T = Record<string, string | number>>(handle: FileSystemFileHandle | File) {
  const { rows } = await parseCsvFileWithMeta<T>(handle);
  return rows;
}

export async function parseWithSchema<T>(handle: FileSystemFileHandle | File, required: string[]) {
  const rows = await parseCsvFile<Record<string, unknown>>(handle);
  const missing = validateColumns(Object.keys(rows[0] ?? {}), required);
  if (missing.length) throw new ValidationError(`Colonnes manquantes: ${missing.join(', ')}`);
  return rows as unknown as T[];
}
