import { seedGrowAssign } from './seedGrow';
import type { AutoAssignState, AutoAssignConfig } from './seedGrow';
export type { AutoAssignConfig } from './seedGrow';
import type { Observation } from '../types';

export function autoAssignObjects(state: AutoAssignState, objectIds: string[], config: AutoAssignConfig) {
  const observationsByObjectId: Record<string, Observation[]> = { ...state.observationsByObjectId };
  const assigned = new Set<string>();
  Object.values(observationsByObjectId).forEach((list) => {
    list?.forEach((obs) => assigned.add(obs.detection_id));
  });

  objectIds.forEach((objectId) => {
    const updated = seedGrowAssign(state, objectId, assigned, config);
    observationsByObjectId[objectId] = updated;
    updated.forEach((obs) => assigned.add(obs.detection_id));
  });

  return observationsByObjectId;
}
