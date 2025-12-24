export const BOX_COLUMNS = ['pano_id', 'xmin', 'ymin', 'xmax', 'ymax'];
export const META_COLUMNS = ['pano_id', 'lat', 'lon', 'heading', 'imageWidth', 'imageHeight'];
export const PROJECT_COLUMNS = ['row_type', 'object_id', 'pano_id'];

export const META_ALIASES: Record<string, string[]> = {
  lat: ['latitude'],
  lon: ['lng', 'longitude'],
  imageWidth: ['image_width', 'imagewidth'],
  imageHeight: ['image_height', 'imageheight'],
};

export function validateColumns(found: string[], expected: string[], aliases: Record<string, string[]> = {}): string[] {
  const normalized = found.map((c) => c.trim().toLowerCase());
  const foundSet = new Set(normalized);
  return expected.filter((col) => {
    const candidates = [col, ...(aliases[col] ?? [])].map((c) => c.toLowerCase());
    return !candidates.some((c) => foundSet.has(c));
  });
}
