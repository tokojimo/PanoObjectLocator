export const BOX_COLUMNS = ['pano_id', 'xmin', 'ymin', 'xmax', 'ymax'];
export const META_COLUMNS = ['pano_id', 'lat', 'lon', 'heading', 'imageWidth', 'imageHeight'];
export const PROJECT_COLUMNS = ['row_type', 'object_id', 'pano_id'];

export function validateColumns(found: string[], expected: string[]): string[] {
  const normalized = found.map((c) => c.trim());
  return expected.filter((col) => !normalized.includes(col));
}
