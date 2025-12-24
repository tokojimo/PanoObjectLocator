import { useMemo } from 'react';
import { selectObservationAssignments } from '../state/selectors';
import { useStore } from '../state/store';

export default function TodoList() {
  const { state, dispatch } = useStore();
  const assignments = useMemo(() => selectObservationAssignments(state), [state.observationsByObjectId]);
  const unassignedDetections = useMemo(
    () => Object.values(state.detectionsById).filter((d) => !assignments[d.detection_id]),
    [state.detectionsById, assignments]
  );
  const weakObjects = useMemo(
    () => Object.values(state.objectsById).filter((obj) => obj.n_obs < 2),
    [state.objectsById]
  );

  const goToDetection = (panoId: string, detectionId: string) => {
    dispatch({ type: 'openPano', payload: panoId });
    dispatch({ type: 'setHighlight', payload: { pano_id: panoId, detection_id: detectionId } });
  };

  return (
    <div className="panel">
      <h3>Objets non définis</h3>
      {!unassignedDetections.length && !weakObjects.length && <div className="status">Aucun élément en attente.</div>}
      {unassignedDetections.length > 0 && (
        <div className="list" style={{ marginBottom: 8 }}>
          <div className="status">Boxes libres</div>
          {unassignedDetections.map((det) => (
            <button key={det.detection_id} className="secondary" onClick={() => goToDetection(det.pano_id, det.detection_id)}>
              {det.pano_id} • {det.detection_id}
            </button>
          ))}
        </div>
      )}
      {weakObjects.length > 0 && (
        <div className="list">
          <div className="status">Objets à compléter (&lt;2 obs)</div>
          {weakObjects.map((obj) => (
            <div key={obj.object_id} className="row" style={{ borderLeft: `4px solid ${obj.color}` }}>
              <div>
                <strong>{obj.object_id}</strong>
                <div className="status">Observations: {obj.n_obs}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
