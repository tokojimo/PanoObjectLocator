import { Detection, Pano } from '../types';
import { selectDetectionsForPano } from '../state/selectors';
import { useStore } from '../state/store';
import { PanoViewer } from './PanoViewer';

export function PanoCard({ pano }: { pano: Pano }) {
  const { state, dispatch } = useStore();
  const detections = selectDetectionsForPano(state, pano.pano_id);
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <strong>{pano.pano_id}</strong>
          <span className="badge">{detections.length} boxes</span>
        </div>
        <button className="secondary" onClick={() => dispatch({ type: 'closePano', payload: pano.pano_id })}>
          ❌
        </button>
      </div>
      <PanoViewer pano={pano} detections={detections} />
    </div>
  );
}
