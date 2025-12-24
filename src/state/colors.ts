const palette = [
  '#0ea5e9',
  '#f97316',
  '#22c55e',
  '#6366f1',
  '#e11d48',
  '#14b8a6',
  '#a855f7',
  '#facc15',
  '#ef4444',
  '#0ea5e9',
];

export function buildColorMap(objectIds: string[]) {
  const map: Record<string, string> = {};
  objectIds.forEach((id, idx) => {
    map[id] = palette[idx % palette.length];
  });
  return map;
}
