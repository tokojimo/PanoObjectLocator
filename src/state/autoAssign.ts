import { seedGrowAssign } from './seedGrow';
import type { AutoAssignState, AutoAssignConfig } from './seedGrow';
export type { AutoAssignConfig } from './seedGrow';
import type { Observation } from '../types';

export type AutoAssignProgressHandler = (progress: {
  current: number;
  total: number;
  objectId: string;
}) => void;

export function autoAssignObjects(state: AutoAssignState, objectIds: string[], config: AutoAssignConfig) {
  const observationsByObjectId: Record<string, Observation[]> = { ...state.observationsByObjectId };
  const assigned = new Set<string>();

  Object.values(observationsByObjectId).forEach((list) => {
    list?.forEach((obs) => assigned.add(obs.detection_id));
  });

  objectIds.forEach((objectId) => {
    const updated = seedGrowAssign({ ...state, observationsByObjectId }, objectId, assigned, config);
    const merged = [...(observationsByObjectId[objectId] ?? []), ...updated];
    const deduped = new Map(merged.map((obs) => [obs.detection_id, obs]));

    observationsByObjectId[objectId] = Array.from(deduped.values());
    observationsByObjectId[objectId].forEach((obs) => assigned.add(obs.detection_id));
  });

  return observationsByObjectId;
}

export async function autoAssignObjectsProgressive(
  state: AutoAssignState,
  objectIds: string[],
  config: AutoAssignConfig,
  onProgress?: AutoAssignProgressHandler
) {
  const observationsByObjectId: Record<string, Observation[]> = { ...state.observationsByObjectId };
  const assigned = new Set<string>();

  Object.values(observationsByObjectId).forEach((list) => {
    list?.forEach((obs) => assigned.add(obs.detection_id));
  });

  for (let index = 0; index < objectIds.length; index += 1) {
    const objectId = objectIds[index];
    const updated = seedGrowAssign({ ...state, observationsByObjectId }, objectId, assigned, config);
    const merged = [...(observationsByObjectId[objectId] ?? []), ...updated];
    const deduped = new Map(merged.map((obs) => [obs.detection_id, obs]));

    observationsByObjectId[objectId] = Array.from(deduped.values());
    observationsByObjectId[objectId].forEach((obs) => assigned.add(obs.detection_id));

    onProgress?.({ current: index + 1, total: objectIds.length, objectId });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return observationsByObjectId;
}
