import { clusterPanos, createAutoAssignContext, seedGrowAssign } from './seedGrow';
import type { AutoAssignState, AutoAssignConfig, PanoCluster } from './seedGrow';
export type { AutoAssignConfig, PanoCluster } from './seedGrow';
import type { Observation } from '../types';

export type AutoAssignProgressHandler = (progress: {
  current: number;
  total: number;
  objectId: string;
}) => void;

export function autoAssignObjects(state: AutoAssignState, objectIds: string[], config: AutoAssignConfig) {
  const observationsByObjectId: Record<string, Observation[]> = { ...state.observationsByObjectId };
  const assigned = new Set<string>();
  // Share assigned/context across the whole run to avoid redundant bucket rebuilds and
  // per-object dedup passes.
  const context = createAutoAssignContext(state);
  const totalDetections = Object.keys(state.detectionsById).length;
  const workingState: AutoAssignState = { ...state, observationsByObjectId };

  Object.values(observationsByObjectId).forEach((list) => {
    list?.forEach((obs) => assigned.add(obs.detection_id));
  });

  for (const objectId of objectIds) {
    if (assigned.size >= totalDetections) break;
    const updated = seedGrowAssign(workingState, objectId, assigned, config, context);
    observationsByObjectId[objectId] = updated;
    updated.forEach((obs) => assigned.add(obs.detection_id));
  }

  return observationsByObjectId;
}

export function previewPanoClusters(state: AutoAssignState, config: AutoAssignConfig): PanoCluster[] {
  const observationsByObjectId: Record<string, Observation[]> = { ...state.observationsByObjectId };
  const assigned = new Set<string>();
  const context = createAutoAssignContext(state);

  Object.values(observationsByObjectId).forEach((list) => {
    list?.forEach((obs) => assigned.add(obs.detection_id));
  });

  return clusterPanos(
    state,
    assigned,
    context.detectionsByPano,
    context.panoBuckets,
    config.clusterDistanceM
  );
}

export async function autoAssignObjectsProgressive(
  state: AutoAssignState,
  objectIds: string[],
  config: AutoAssignConfig,
  onProgress?: AutoAssignProgressHandler
) {
  const observationsByObjectId: Record<string, Observation[]> = { ...state.observationsByObjectId };
  const assigned = new Set<string>();
  const context = createAutoAssignContext(state);
  const totalDetections = Object.keys(state.detectionsById).length;
  const workingState: AutoAssignState = { ...state, observationsByObjectId };

  Object.values(observationsByObjectId).forEach((list) => {
    list?.forEach((obs) => assigned.add(obs.detection_id));
  });

  for (let index = 0; index < objectIds.length; index += 1) {
    const objectId = objectIds[index];
    if (assigned.size >= totalDetections) {
      onProgress?.({ current: objectIds.length, total: objectIds.length, objectId });
      break;
    }
    const updated = seedGrowAssign(workingState, objectId, assigned, config, context);
    observationsByObjectId[objectId] = updated;
    updated.forEach((obs) => assigned.add(obs.detection_id));

    onProgress?.({ current: index + 1, total: objectIds.length, objectId });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return observationsByObjectId;
}
