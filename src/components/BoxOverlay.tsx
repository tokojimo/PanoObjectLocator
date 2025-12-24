import { Detection, ProjectObjectsState } from '../types';

type BoxOverlayProps = {
  detections: Detection[];
  imageWidth: number;
  imageHeight: number;
  assignments: Record<string, string>;
  objectsById: ProjectObjectsState;
  activeObjectId?: string;
  highlight?: { pano_id: string; detection_id: string };
  onSelect: (d: Detection) => void;
};

export function BoxOverlay({
  detections,
  imageWidth,
  imageHeight,
  assignments,
  objectsById,
  activeObjectId,
  highlight,
  onSelect,
}: BoxOverlayProps) {
  return (
    <svg
      className="box-overlay"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
    >
      {detections.map((detection) => {
        const assignedObjectId = assignments[detection.detection_id];
        const assignedColor = assignedObjectId ? objectsById[assignedObjectId]?.color ?? '#f43f5e' : '#f43f5e';
        const isActive = assignedObjectId && activeObjectId === assignedObjectId;
        const isHighlighted =
          highlight?.detection_id === detection.detection_id && highlight?.pano_id === detection.pano_id;
        return (
          <g key={detection.detection_id}>
            <rect
              x={detection.xmin}
              y={detection.ymin}
              width={detection.xmax - detection.xmin}
              height={detection.ymax - detection.ymin}
              fill={isActive ? `${assignedColor}30` : 'transparent'}
              stroke={assignedColor}
              strokeWidth={isHighlighted ? 3 : 2}
              className={isHighlighted ? 'box-rect highlighted' : 'box-rect'}
              onClick={() => onSelect(detection)}
            />
            <text x={detection.xmin + 4} y={detection.ymin + 14} fill={assignedColor} fontSize={12} pointerEvents="none">
              {assignedObjectId ?? 'Libre'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
