import { Detection } from '../types';

export function BoxOverlay({ detections, onSelect }: { detections: Detection[]; onSelect: (d: Detection) => void }) {
  if (!detections.length) return <p>Aucune box pour ce pano.</p>;
  return (
    <div className="list">
      {detections.map((d) => (
        <button key={d.detection_id} className="secondary" onClick={() => onSelect(d)}>
          Box {d.detection_id}
        </button>
      ))}
    </div>
  );
}
