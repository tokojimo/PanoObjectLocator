export function rmsFromObservations(nObs: number) {
  if (nObs < 2) return undefined;
  return Math.max(0.5, 5 / nObs);
}
