// Keep the pano marker blue (#0ea5e9) out of the object palette.
const palette = [
  '#f97316',
  '#22c55e',
  '#e11d48',
  '#14b8a6',
  '#a855f7',
  '#facc15',
  '#ef4444',
  '#8b5cf6',
  '#d946ef',
  '#84cc16',
];

export function buildColorMap(objectIds: string[]) {
  const map: Record<string, string> = {};
  objectIds.forEach((id, idx) => {
    map[id] = palette[idx % palette.length];
  });
  return map;
}
