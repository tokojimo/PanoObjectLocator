import { useEffect, useMemo, useState } from 'react';
import { Detection, Observation, Pano } from '../types';
import { BoxOverlay } from './BoxOverlay';
import { useStore } from '../state/store';
import { selectObservationAssignments } from '../state/selectors';
import { bearingFromBox } from '../geo/bearing';
import { makeObservationId } from '../utils/ids';
import { nowIso } from '../utils/time';

export function PanoViewer({ pano, detections }: { pano: Pano; detections: Detection[] }) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(pano.imageUrl);
  const { state, dispatch } = useStore();
  const assignments = useMemo(() => selectObservationAssignments(state), [state.observationsByObjectId]);

  useEffect(() => {
    let revoked: string | undefined;
    (async () => {
      if (pano.imageFileHandle) {
        const file = await pano.imageFileHandle.getFile();
        const url = URL.createObjectURL(file);
        setImageUrl(url);
        revoked = url;
      } else if (pano.imageUrl) {
        setImageUrl(pano.imageUrl);
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [pano.imageFileHandle, pano.imageUrl]);

  const ensureActiveObject = () => {
    if (state.activeObjectId) return state.activeObjectId;
    const newId = `obj-${Object.keys(state.objectsById).length + 1}`;
    dispatch({ type: 'addObject' });
    return newId;
  };

  const handleSelect = (detection: Detection) => {
    const activeId = ensureActiveObject();
    const existingObjectId = assignments[detection.detection_id];
    const panoMeta = state.panosById[detection.pano_id];
    if (!panoMeta) return;

    if (existingObjectId && existingObjectId === activeId) {
      dispatch({ type: 'removeObservation', payload: { object_id: activeId, detection_id: detection.detection_id } });
      return;
    }

    const { bearing, cx } = bearingFromBox(detection.xmin, detection.xmax, panoMeta.imageWidth, panoMeta.heading);
    const observation: Observation = {
      obs_id: makeObservationId(),
      object_id: activeId,
      detection_id: detection.detection_id,
      pano_id: detection.pano_id,
      xmin: detection.xmin,
      ymin: detection.ymin,
      xmax: detection.xmax,
      ymax: detection.ymax,
      cx,
      bearing_deg: bearing,
      pano_lat: panoMeta.lat,
      pano_lng: panoMeta.lng,
      created_at: nowIso(),
    };

    if (existingObjectId && existingObjectId !== activeId) {
      const confirmed = window.confirm('Ce box est déjà assigné à un autre objet. Réassigner ?');
      if (!confirmed) return;
      dispatch({ type: 'reassignObservation', payload: { from: existingObjectId, to: activeId, detection_id: detection.detection_id, observation } });
    } else {
      dispatch({ type: 'addObservation', payload: observation });
    }
    dispatch({ type: 'setHighlight', payload: { pano_id: detection.pano_id, detection_id: detection.detection_id } });
  };

  return (
    <div>
      <div className="pano-frame">
        <div className="pano-canvas">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt={pano.pano_id} className="pano-image" />
              <div className="pano-meta">
                <span className="badge">Heading {pano.heading}°</span>
              </div>
              <BoxOverlay
                detections={detections}
                imageWidth={pano.imageWidth}
                imageHeight={pano.imageHeight}
                assignments={assignments}
                objectsById={state.objectsById}
                activeObjectId={state.activeObjectId}
                highlight={state.ui.highlight}
                onSelect={handleSelect}
              />
            </>
          ) : (
            <p>Image locale non chargée.</p>
          )}
        </div>
      </div>
    </div>
  );
}
