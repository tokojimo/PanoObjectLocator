export function makeDetectionId(panoId: string, xmin: number, ymin: number, xmax: number, ymax: number, score?: number) {
  return [panoId, xmin, ymin, xmax, ymax, score ?? ''].join('_');
}

export function makeObservationId() {
  return `obs_${crypto.randomUUID()}`;
}
