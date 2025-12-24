import { AppState } from './store';

export function selectPanos(state: AppState) {
  return Object.values(state.panosById);
}

export function selectDetectionsForPano(state: AppState, panoId: string) {
  return Object.values(state.detectionsById).filter((d) => d.pano_id === panoId);
}

export function selectObservationAssignments(state: AppState) {
  const map: Record<string, string> = {};
  Object.entries(state.observationsByObjectId).forEach(([objectId, observations]) => {
    observations.forEach((obs) => {
      map[obs.detection_id] = objectId;
    });
  });
  return map;
}
