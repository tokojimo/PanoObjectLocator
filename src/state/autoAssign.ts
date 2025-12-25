import { bearingFromBox } from '../geo/bearing';
import { triangulate } from '../geo/triangulation';
import { Detection, Observation, Pano } from '../types';
import { makeObservationId } from '../utils/ids';
import { nowIso } from '../utils/time';

export type AutoAssignConfig = {
  rmsMax: number;
  maxObsPerObject: number;
  minAngleDiff: number;
};

type AutoAssignState = {
  panosById: Record<string, Pano>;
  detectionsById: Record<string, Detection>;
  observationsByObjectId: Record<string, Observation[]>;
};

export function angleDiffDeg(a: number, b: number) {
  const diff = ((a - b + 540) % 360) - 180;
  return Math.abs(diff);
}

export function canUseCandidate(existing: Observation[], candidate: Observation, minAngleDiff: number) {
  if (existing.some((obs) => obs.pano_id === candidate.pano_id)) return false;
  return existing.every((obs) => angleDiffDeg(obs.bearing_deg, candidate.bearing_deg) >= minAngleDiff);
}

export function simulateRms(existing: Observation[], candidate: Observation) {
  const trial = [...existing, candidate];
  if (trial.length < 2) return Infinity;
  const result = triangulate(trial);
  return result?.rms ?? Infinity;
}

function buildUnassignedDetections(state: AutoAssignState, assigned: Set<string>) {
  return Object.values(state.detectionsById).filter((det) => !assigned.has(det.detection_id));
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

function greedyAssign(
  state: AutoAssignState,
  objectId: string,
  observationsByObjectId: Record<string, Observation[]>,
  assigned: Set<string>,
  config: AutoAssignConfig,
  candidateCap = 500
) {
  const availableDetections = buildUnassignedDetections(state, assigned);
  const existing = [...(observationsByObjectId[objectId] ?? [])];

  while (existing.length < config.maxObsPerObject) {
    let bestCandidate: Observation | undefined;
    let bestRms = Infinity;
    let tested = 0;

    for (const det of availableDetections) {
      if (assigned.has(det.detection_id)) continue;
      if (tested >= candidateCap) break;
      tested += 1;
      const panoMeta = state.panosById[det.pano_id];
      if (!panoMeta) continue;

      const candidate = makeObservationFromDetection(objectId, det, panoMeta);
      if (!canUseCandidate(existing, candidate, config.minAngleDiff)) continue;

      const rms = simulateRms(existing, candidate);
      const prospectiveCount = existing.length + 1;
      if (prospectiveCount >= 2 && rms > config.rmsMax) continue;

      if (!bestCandidate || rms < bestRms) {
        bestCandidate = candidate;
        bestRms = rms;
      }
    }

    if (!bestCandidate) break;

    existing.push(bestCandidate);
    assigned.add(bestCandidate.detection_id);
  }

  observationsByObjectId[objectId] = existing;
}

export function autoAssignObjects(state: AutoAssignState, objectIds: string[], config: AutoAssignConfig) {
  const observationsByObjectId: Record<string, Observation[]> = { ...state.observationsByObjectId };
  const assigned = new Set<string>();
  Object.values(observationsByObjectId).forEach((list) => {
    list?.forEach((obs) => assigned.add(obs.detection_id));
  });

  objectIds.forEach((objectId) => {
    greedyAssign(state, objectId, observationsByObjectId, assigned, config);
  });

  return observationsByObjectId;
}
