import { Observation } from '../types';

export type TriangulationResult = {
  lat: number;
  lng: number;
  rms: number;
  n_obs: number;
  stable: boolean;
};

export function triangulate(observations: Observation[]): TriangulationResult | undefined {
  if (observations.length < 2) return undefined;

  const meanLat = observations.reduce((acc, obs) => acc + obs.pano_lat, 0) / observations.length;
  const meanLng = observations.reduce((acc, obs) => acc + obs.pano_lng, 0) / observations.length;
  const degToM = 111320;
  const cosLat = Math.cos((meanLat * Math.PI) / 180);

  const toLocal = (lat: number, lng: number) => ({
    x: (lng - meanLng) * degToM * cosLat,
    y: (lat - meanLat) * degToM,
  });

  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  let b1 = 0;
  let b2 = 0;

  observations.forEach((obs) => {
    const { x, y } = toLocal(obs.pano_lat, obs.pano_lng);
    const theta = ((obs.bearing_deg ?? 0) * Math.PI) / 180;
    const vx = Math.sin(theta);
    const vy = Math.cos(theta);
    const p11 = 1 - vx * vx;
    const p12 = -vx * vy;
    const p22 = 1 - vy * vy;

    a11 += p11;
    a12 += p12;
    a22 += p22;
    b1 += p11 * x + p12 * y;
    b2 += p12 * x + p22 * y;
  });

  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-6) return undefined;
  const inv11 = a22 / det;
  const inv12 = -a12 / det;
  const inv22 = a11 / det;
  const cx = inv11 * b1 + inv12 * b2;
  const cy = inv12 * b1 + inv22 * b2;

  let sumSq = 0;
  observations.forEach((obs) => {
    const { x, y } = toLocal(obs.pano_lat, obs.pano_lng);
    const theta = ((obs.bearing_deg ?? 0) * Math.PI) / 180;
    const vx = Math.sin(theta);
    const vy = Math.cos(theta);
    const dx = cx - x;
    const dy = cy - y;
    const projX = dx - (vx * (vx * dx + vy * dy));
    const projY = dy - (vy * (vx * dx + vy * dy));
    sumSq += projX * projX + projY * projY;
  });

  const rms = Math.sqrt(sumSq / observations.length);
  const lat = cy / degToM + meanLat;
  const lng = cx / (degToM * cosLat) + meanLng;
  return { lat, lng, rms, n_obs: observations.length, stable: true };
}
