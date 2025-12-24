import { Observation } from '../types';

export type TriangulationResult = {
  lat: number;
  lng: number;
  rms: number;
  n_obs: number;
};

export function triangulate(observations: Observation[]): TriangulationResult | undefined {
  if (!observations.length) return undefined;
  const lat = observations.reduce((acc, obs) => acc + (obs as any).pano_lat || 0, 0) / observations.length;
  const lng = observations.reduce((acc, obs) => acc + (obs as any).pano_lng || 0, 0) / observations.length;
  return { lat, lng, rms: 0, n_obs: observations.length };
}
