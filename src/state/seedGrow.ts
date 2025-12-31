import { bearingFromBox } from '../geo/bearing';
import { triangulate, TriangulationResult } from '../geo/triangulation';
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

type DetectionBuckets = Record<string, Detection[]>;
type PanoBuckets = ReturnType<typeof buildPanoBuckets>;
type ObservationGeometry = {
  cx: number;
  bearing_deg: number;
  pano_lat: number;
  pano_lng: number;
};

type ObservationGeometryCache = Map<string, ObservationGeometry>;
type TriangulationCache = Map<string, TriangulationResult | null>;
type AutoAssignContext = {
  detectionsByPano: DetectionBuckets;
  panoBuckets: PanoBuckets;
  geometryCache: ObservationGeometryCache;
  triangulationCache: TriangulationCache;
};

const EARTH_RADIUS_M = 6371000;
const CLUSTER_DISTANCE_M = 80;
const BUCKET_SIZE_DEG = 0.001;

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

function getObservationGeometry(
  detection: Detection,
  pano: Pano,
  cache: ObservationGeometryCache
): ObservationGeometry {
  const cached = cache.get(detection.detection_id);
  if (cached) return cached;

  const { bearing, cx } = bearingFromBox(detection.xmin, detection.xmax, pano.imageWidth, pano.heading);
  const geometry: ObservationGeometry = {
    cx,
    bearing_deg: bearing,
    pano_lat: pano.lat,
    pano_lng: pano.lng,
  };
  cache.set(detection.detection_id, geometry);
  return geometry;
}

function makeObservationFromDetection(
  objectId: string,
  detection: Detection,
  pano: Pano,
  cache: ObservationGeometryCache
): Observation {
  const { bearing_deg, cx, pano_lat, pano_lng } = getObservationGeometry(detection, pano, cache);
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
    bearing_deg,
    pano_lat,
    pano_lng,
    created_at: nowIso(),
  };
}

function triangulateWithCache(
  observations: Observation[],
  cache: TriangulationCache
): TriangulationResult | undefined {
  // Triangulation is pure on detection_id order; cache by ids to avoid recomputing
  // identical sets while seeds/clusters iterate.
  const ids = observations
    .map((obs) => obs.detection_id)
    .filter(Boolean)
    .sort()
    .join('|');

  const cached = cache.get(ids);
  if (cached !== undefined) return cached ?? undefined;

  const result = triangulate(observations) ?? null;
  cache.set(ids, result);
  return result ?? undefined;
}

function buildDetectionBuckets(state: AutoAssignState) {
  const detectionsByPano: Record<string, Detection[]> = {};
  Object.values(state.detectionsById).forEach((det) => {
    if (!detectionsByPano[det.pano_id]) detectionsByPano[det.pano_id] = [];
    detectionsByPano[det.pano_id].push(det);
  });
  return detectionsByPano;
}

function buildPanoBuckets(panoIds: string[], state: AutoAssignState) {
  const buckets = new Map<string, string[]>();
  const coords: Record<string, { lat: number; lng: number }> = {};

  panoIds.forEach((panoId) => {
    const pano = state.panosById[panoId];
    if (!pano) return;
    coords[panoId] = { lat: pano.lat, lng: pano.lng };
    const latBucket = Math.floor(pano.lat / BUCKET_SIZE_DEG);
    const lngBucket = Math.floor(pano.lng / BUCKET_SIZE_DEG);
    const key = `${latBucket}:${lngBucket}`;
    const list = buckets.get(key) ?? [];
    list.push(panoId);
    buckets.set(key, list);
  });

  const nearby = (lat: number, lng: number) => {
    const latBucket = Math.floor(lat / BUCKET_SIZE_DEG);
    const lngBucket = Math.floor(lng / BUCKET_SIZE_DEG);
    const candidates: string[] = [];

    for (let dLat = -1; dLat <= 1; dLat += 1) {
      for (let dLng = -1; dLng <= 1; dLng += 1) {
        const key = `${latBucket + dLat}:${lngBucket + dLng}`;
        const list = buckets.get(key);
        if (list) candidates.push(...list);
      }
    }

    return candidates;
  };

  return { nearby, coords };
}

export function createAutoAssignContext(state: AutoAssignState): AutoAssignContext {
  // Build pano/detection buckets once per auto-assign run to avoid repeated O(n)
  // scans across panos and detections in clusterPanos / bestSeedForCluster.
  const detectionsByPano = buildDetectionBuckets(state);
  const panoIds = Object.keys(detectionsByPano);

  return {
    detectionsByPano,
    panoBuckets: buildPanoBuckets(panoIds, state),
    geometryCache: new Map(),
    triangulationCache: new Map(),
  };
}

function clusterPanos(
  state: AutoAssignState,
  assigned: Set<string>,
  detectionsByPano: DetectionBuckets,
  panoBuckets: PanoBuckets
): PanoCluster[] {
  const panoIds = Object.keys(detectionsByPano).filter((id) =>
    (detectionsByPano[id] ?? []).some((det) => !assigned.has(det.detection_id))
  );
  const { nearby, coords } = panoBuckets;
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
      detectionsByPano[current]?.forEach((det) => {
        if (!assigned.has(det.detection_id)) detectionIds.push(det.detection_id);
      });

      const currentCoords = coords[current];
      if (!currentCoords) continue;

      const candidates = nearby(currentCoords.lat, currentCoords.lng);
      candidates.forEach((candidate) => {
        if (visited.has(candidate) || panoCluster.has(candidate) || candidate === current) return;
        const neighborCoords = coords[candidate];
        if (!neighborCoords) return;
        if (
          distanceMeters(
            { lat: currentCoords.lat, lng: currentCoords.lng },
            { lat: neighborCoords.lat, lng: neighborCoords.lng }
          ) <= CLUSTER_DISTANCE_M
        ) {
          queue.push(candidate);
        }
      });
    }

    if (panoCluster.size >= 2) {
      const panoIdsList = [...panoCluster];
      const panoWithMultipleBoxes = panoIdsList.filter((id) =>
        (detectionsByPano[id] ?? []).filter((det) => !assigned.has(det.detection_id)).length >= 2
      ).length;
      const score = detectionIds.length + panoWithMultipleBoxes * 2 + panoIdsList.length;
      clusters.push({ panoIds: panoIdsList, detectionIds, score });
    }
  });

  return clusters.sort((a, b) => b.score - a.score);
}

function growCluster(
  state: AutoAssignState,
  objectId: string,
  seed: Observation[],
  candidateDetections: Detection[],
  config: AutoAssignConfig,
  context: AutoAssignContext
): ClusterGrowth {
  const observations = [...seed];
  let currentResult = triangulateWithCache(observations, context.triangulationCache) ?? undefined;
  let currentCenter = currentResult ?? {
    lat: observations[0]?.pano_lat,
    lng: observations[0]?.pano_lng,
    rms: currentResult?.rms ?? 0,
    n_obs: observations.length,
    stable: Boolean(currentResult),
  };

  const sortedCandidates = candidateDetections
    .map((det, idx) => ({ det, idx, pano: state.panosById[det.pano_id] }))
    .filter((item) => item.pano);

  // Prefer nearer panos first; tie-break on original order to limit behaviour drift
  // while cutting down the amount of growth/triangulation attempts needed.
  sortedCandidates.sort((a, b) => {
    const distA = currentCenter?.lat !== undefined && currentCenter?.lng !== undefined
      ? distanceMeters(
          { lat: currentCenter.lat ?? a.pano!.lat, lng: currentCenter.lng ?? a.pano!.lng },
          { lat: a.pano!.lat, lng: a.pano!.lng }
        )
      : a.idx;
    const distB = currentCenter?.lat !== undefined && currentCenter?.lng !== undefined
      ? distanceMeters(
          { lat: currentCenter.lat ?? b.pano!.lat, lng: currentCenter.lng ?? b.pano!.lng },
          { lat: b.pano!.lat, lng: b.pano!.lng }
        )
      : b.idx;
    if (distA === distB) return a.idx - b.idx;
    return distA - distB;
  });

  for (const { det, pano, idx } of sortedCandidates) {
    if (observations.length >= config.maxObsPerObject) break;
    if (!pano) continue;
    const candidate = makeObservationFromDetection(objectId, det, pano, context.geometryCache);
    if (!canUseCandidate(observations, candidate, config.minAngleDiff)) continue;

    const trialObservations = [...observations, candidate];
    const result = triangulateWithCache(trialObservations, context.triangulationCache);
    if (!result) continue;

    const shift = currentResult
      ? distanceMeters({ lat: currentResult.lat, lng: currentResult.lng }, { lat: result.lat, lng: result.lng })
      : 0;
    if (result.rms > config.rmsMax) continue;
    if (shift > config.maxShiftM) continue;

    observations.push(candidate);
    currentResult = result;
    currentCenter = result;

    // Early exit: the greedy search cannot improve past these bounds without changing
    // thresholds, so stop evaluating remaining candidates once the cluster is full or
    // already stable enough.
    if (currentResult.rms <= config.rmsMax && observations.length === config.maxObsPerObject) break;
    if (idx > config.maxObsPerObject * 3 && currentResult.rms <= config.rmsMax / 2) break;
  }

  return { observations, rms: currentResult?.rms ?? 0 };
}

function bestSeedForCluster(
  state: AutoAssignState,
  objectId: string,
  cluster: PanoCluster,
  assigned: Set<string>,
  config: AutoAssignConfig,
  context: AutoAssignContext
): Observation[] | undefined {
  const seedPairs: [Detection, Detection][] = [];

  cluster.panoIds.forEach((panoA, idx) => {
    const detsA = context.detectionsByPano[panoA] ?? [];
    cluster.panoIds.slice(idx + 1).forEach((panoB) => {
      const detsB = context.detectionsByPano[panoB] ?? [];
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
    const obsA = makeObservationFromDetection(objectId, a, panoA, context.geometryCache);
    const obsB = makeObservationFromDetection(objectId, b, panoB, context.geometryCache);
    const seed = [obsA, obsB];
    const growth = growCluster(
      state,
      objectId,
      seed,
      cluster.detectionIds
        .map((id) => state.detectionsById[id])
        .filter((det): det is Detection => Boolean(det) && !assigned.has(det.detection_id)),
      config,
      context
    );
    if (
      growth.observations.length > bestSize ||
      (growth.observations.length === bestSize && growth.rms < bestRms)
    ) {
      best = growth.observations;
      bestSize = growth.observations.length;
      bestRms = growth.rms;
    }

    if (bestSize >= config.maxObsPerObject && bestRms <= config.rmsMax / 2) break;
  }

  return best;
}

export function seedGrowAssign(
  state: AutoAssignState,
  objectId: string,
  assigned: Set<string>,
  config: AutoAssignConfig,
  context: AutoAssignContext
): Observation[] {
  const existing = [...(state.observationsByObjectId[objectId] ?? [])];
  const clusters = clusterPanos(state, assigned, context.detectionsByPano, context.panoBuckets);
  const candidateDetections = clusters
    .flatMap((cl) => cl.detectionIds)
    .map((id) => state.detectionsById[id])
    .filter((det): det is Detection => Boolean(det) && !assigned.has(det.detection_id));

  if (existing.length >= 2) {
    const grown = growCluster(state, objectId, existing, candidateDetections, config, context);
    return grown.observations;
  }

  let best: Observation[] | undefined;
  let bestSize = existing.length;
  let bestRms = Infinity;

  clusters.forEach((cluster) => {
    const seed = bestSeedForCluster(state, objectId, cluster, assigned, config, context);
    if (!seed) return;
    const total = [...existing, ...seed];
    const unique = new Map(total.map((o) => [o.detection_id, o]));
    const list = [...unique.values()];
    const result = triangulateWithCache(list, context.triangulationCache);
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
      const obs = makeObservationFromDetection(objectId, candidateDetections[0], pano, context.geometryCache);
      return [...existing, obs];
    }
  }

  return existing;
}
