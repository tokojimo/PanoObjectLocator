import { bearingFromBox } from '../geo/bearing';
import { triangulate } from '../geo/triangulation';
import { Detection, Observation, Pano } from '../types';
import { makeObservationId } from '../utils/ids';
import { nowIso } from '../utils/time';
export type AutoAssignConfig = {
  rmsMax: number;
  maxShiftM: number;
  minAngleDiff: number;
  maxObsPerObject: number;
};

export type AutoAssignState = {
  panosById: Record<string, Pano>;
  detectionsById: Record<string, Detection>;
  observationsByObjectId: Record<string, Observation[]>;
};

type PanoCluster = {
  panoIds: string[];
  detectionIds: string[];
  score: number;
};

type ClusterGrowth = {
  observations: Observation[];
  rms: number;
};

const EARTH_RADIUS_M = 6371000;
const CLUSTER_DISTANCE_M = 80;

export function angleDiffDeg(a: number, b: number) {
  const diff = ((a - b + 540) % 360) - 180;
  return Math.abs(diff);
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function canUseCandidate(existing: Observation[], candidate: Observation, minAngleDiff: number) {
  if (existing.some((obs) => obs.pano_id === candidate.pano_id)) return false;
  if (minAngleDiff <= 0) return true;
  return existing.every((obs) => angleDiffDeg(obs.bearing_deg, candidate.bearing_deg) >= minAngleDiff);
}

function makeObservationFromDetection(objectId: string, detection: Detection, pano: Pano): Observation {
  const { bearing, cx } = bearingFromBox(detection.xmin, detection.xmax, pano.imageWidth, pano.heading);
  return {
    obs_id: makeObservationId(),
    object_id: objectId,
    detection_id: detection.detection_id,
    pano_id: detection.pano_id,
    xmin: detection.xmin,
    ymin: detection.ymin,
    xmax: detection.xmax,
    ymax: detection.ymax,
    cx,
    bearing_deg: bearing,
    pano_lat: pano.lat,
    pano_lng: pano.lng,
    created_at: nowIso(),
  };
}

function buildDetectionBuckets(state: AutoAssignState, assigned: Set<string>) {
  const detectionsByPano: Record<string, Detection[]> = {};
  Object.values(state.detectionsById).forEach((det) => {
    if (assigned.has(det.detection_id)) return;
    if (!detectionsByPano[det.pano_id]) detectionsByPano[det.pano_id] = [];
    detectionsByPano[det.pano_id].push(det);
  });
  return detectionsByPano;
}

function clusterPanos(state: AutoAssignState, assigned: Set<string>): PanoCluster[] {
  const detectionsByPano = buildDetectionBuckets(state, assigned);
  const panoIds = Object.keys(state.panosById).filter((id) => detectionsByPano[id]?.length);
  const visited = new Set<string>();
  const clusters: PanoCluster[] = [];

  panoIds.forEach((panoId) => {
    if (visited.has(panoId)) return;
    const queue = [panoId];
    const panoCluster = new Set<string>();
    const detectionIds: string[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      panoCluster.add(current);
      detectionsByPano[current]?.forEach((det) => detectionIds.push(det.detection_id));
      panoIds.forEach((candidate) => {
        if (visited.has(candidate) || panoCluster.has(candidate)) return;
        const a = state.panosById[current];
        const b = state.panosById[candidate];
        if (!a || !b) return;
        if (distanceMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= CLUSTER_DISTANCE_M) {
          queue.push(candidate);
        }
      });
    }
    if (panoCluster.size >= 2) {
      const panoIdsList = [...panoCluster];
      const panoWithMultipleBoxes = panoIdsList.filter((id) => (detectionsByPano[id]?.length ?? 0) >= 2).length;
      const score = detectionIds.length + panoWithMultipleBoxes * 2 + panoIdsList.length;
      clusters.push({ panoIds: panoIdsList, detectionIds, score });
    }
  });

  return clusters.sort((a, b) => b.score - a.score);
}

function growCluster(
  state: AutoAssignState,
  seed: Observation[],
  candidateDetections: Detection[],
  config: AutoAssignConfig
): ClusterGrowth {
  const observations = [...seed];
  let currentResult = triangulate(observations) ?? undefined;

  for (const det of candidateDetections) {
    if (observations.length >= config.maxObsPerObject) break;
    const pano = state.panosById[det.pano_id];
    if (!pano) continue;
    const candidate = makeObservationFromDetection(seed[0]?.object_id ?? det.pano_id, det, pano);
    if (!canUseCandidate(observations, candidate, config.minAngleDiff)) continue;

    const trialObservations = [...observations, candidate];
    const result = triangulate(trialObservations);
    if (!result) continue;

    const shift = currentResult
      ? distanceMeters({ lat: currentResult.lat, lng: currentResult.lng }, { lat: result.lat, lng: result.lng })
      : 0;
    if (result.rms > config.rmsMax) continue;
    if (shift > config.maxShiftM) continue;

    observations.push(candidate);
    currentResult = result;
  }

  return { observations, rms: currentResult?.rms ?? 0 };
}

function bestSeedForCluster(
  state: AutoAssignState,
  objectId: string,
  cluster: PanoCluster,
  assigned: Set<string>,
  config: AutoAssignConfig
): Observation[] | undefined {
  const detectionsByPano = buildDetectionBuckets(state, assigned);
  const seedPairs: [Detection, Detection][] = [];

  cluster.panoIds.forEach((panoA, idx) => {
    const detsA = detectionsByPano[panoA] ?? [];
    cluster.panoIds.slice(idx + 1).forEach((panoB) => {
      const detsB = detectionsByPano[panoB] ?? [];
      detsA.slice(0, 3).forEach((da) => {
        detsB.slice(0, 3).forEach((db) => seedPairs.push([da, db]));
      });
    });
  });

  let best: Observation[] | undefined;
  let bestSize = 0;
  let bestRms = Infinity;

  for (const [a, b] of seedPairs) {
    const panoA = state.panosById[a.pano_id];
    const panoB = state.panosById[b.pano_id];
    if (!panoA || !panoB) continue;
    const obsA = makeObservationFromDetection(objectId, a, panoA);
    const obsB = makeObservationFromDetection(objectId, b, panoB);
    const seed = [obsA, obsB];
    const growth = growCluster(
      state,
      seed,
      cluster.detectionIds
        .map((id) => state.detectionsById[id])
        .filter((det): det is Detection => Boolean(det) && !assigned.has(det.detection_id)),
      config
    );
    if (growth.observations.length > bestSize ||
        (growth.observations.length === bestSize && growth.rms < bestRms)) {
      best = growth.observations;
      bestSize = growth.observations.length;
      bestRms = growth.rms;
    }
  }

  return best;
}

export function seedGrowAssign(
  state: AutoAssignState,
  objectId: string,
  assigned: Set<string>,
  config: AutoAssignConfig
): Observation[] {
  const existing = [...(state.observationsByObjectId[objectId] ?? [])];
  const clusters = clusterPanos(state, assigned);
  const candidateDetections = clusters
    .flatMap((cl) => cl.detectionIds)
    .map((id) => state.detectionsById[id])
    .filter((det): det is Detection => Boolean(det) && !assigned.has(det.detection_id));

  if (existing.length >= 2) {
    const grown = growCluster(state, existing, candidateDetections, config);
    return grown.observations;
  }

  let best: Observation[] | undefined;
  let bestSize = existing.length;
  let bestRms = Infinity;

  clusters.forEach((cluster) => {
    const seed = bestSeedForCluster(state, objectId, cluster, assigned, config);
    if (!seed) return;
    const total = [...existing, ...seed];
    const unique = new Map(total.map((o) => [o.detection_id, o]));
    const list = [...unique.values()];
    const result = triangulate(list);
    const rms = result?.rms ?? 0;
    if (list.length > bestSize || (list.length === bestSize && rms < bestRms)) {
      best = list;
      bestSize = list.length;
      bestRms = rms;
    }
  });

  if (best && best.length >= 2) return best;
  if (existing.length >= 1 && candidateDetections.length) {
    const pano = state.panosById[candidateDetections[0].pano_id];
    if (pano) {
      const obs = makeObservationFromDetection(objectId, candidateDetections[0], pano);
      return [...existing, obs];
    }
  }

  return existing;
}
