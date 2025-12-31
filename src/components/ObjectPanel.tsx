import { useMemo } from 'react';
import { AutoAssignConfig, autoAssignObjectsProgressive } from '../state/autoAssign';
import { selectObservationAssignments } from '../state/selectors';
import { useStore } from '../state/store';

export default function ObjectPanel() {
  const { state, dispatch } = useStore();
  const objects = useMemo(() => Object.values(state.objectsById), [state.objectsById]);
  const assignments = useMemo(() => selectObservationAssignments(state), [state.observationsByObjectId]);
  const unassignedCount = useMemo(
    () => Object.values(state.detectionsById).filter((d) => !assignments[d.detection_id]).length,
    [state.detectionsById, assignments]
  );

  const handleConfigChange = (key: keyof AutoAssignConfig, value: number) => {
    if (!Number.isFinite(value)) return;
    dispatch({ type: 'setAutoAssignConfig', payload: { [key]: value } });
  };

  const runAutoAssign = async (mode: 'active' | 'all') => {
    const baseObjectIds = mode === 'active' && state.activeObjectId ? [state.activeObjectId] : Object.keys(state.objectsById);
    const objectIds = baseObjectIds.length ? [...baseObjectIds] : [`obj-${Object.keys(state.objectsById).length + 1}`];
    const observationsByObjectId = { ...state.observationsByObjectId };

    objectIds.forEach((id) => {
      if (!observationsByObjectId[id]) observationsByObjectId[id] = [];
    });

    dispatch({ type: 'setAutoAssignProgress', payload: { mode, current: 0, total: objectIds.length } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const updatedObservations = await autoAssignObjectsProgressive(
        { panosById: state.panosById, detectionsById: state.detectionsById, observationsByObjectId },
        objectIds,
        state.ui.autoAssign,
        (progress) => dispatch({ type: 'setAutoAssignProgress', payload: { mode, ...progress } })
      );

      dispatch({ type: 'applyAutoAssign', payload: { observationsByObjectId: updatedObservations } });
    } finally {
      dispatch({ type: 'setAutoAssignProgress', payload: undefined });
    }
  };

  const hasDetections = Object.keys(state.detectionsById).length > 0;
  const progress = state.ui.autoAssignProgress;
  const isRunning = Boolean(progress);

  return (
    <div className="panel">
      <h3>Objet actif</h3>
      <div className="button-row" style={{ marginBottom: 8 }}>
        <button type="button" onClick={() => dispatch({ type: 'addObject' })}>
          Nouvel objet
        </button>
        <select
          value={state.activeObjectId ?? ''}
          onChange={(e) => dispatch({ type: 'setActiveObject', payload: e.target.value || undefined })}
        >
          <option value="">(aucun)</option>
          {objects.map((obj) => (
            <option key={obj.object_id} value={obj.object_id}>
              {obj.object_id}
            </option>
          ))}
        </select>
      </div>
      {state.activeObjectId && (
        <div className="status">
          Actif: {state.activeObjectId}{' '}
          <span className="badge" style={{ background: state.objectsById[state.activeObjectId]?.color }}>
            couleur
          </span>
        </div>
      )}
      <div className="status">Objets: {objects.length}</div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <div>
            <div className="status" style={{ margin: 0 }}>
              Paramètres
            </div>
            <strong>Auto-assign</strong>
          </div>
          <span className="badge">Boxes libres: {unassignedCount}</span>
        </div>
        <div className="auto-grid">
          <label className="field">
            <div className="status">RMS_MAX (m): {state.ui.autoAssign.rmsMax}</div>
            <div className="field-controls">
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={state.ui.autoAssign.rmsMax}
                onChange={(e) => handleConfigChange('rmsMax', Number(e.target.value))}
              />
              <input
                type="number"
                min={0.5}
                step={0.1}
                value={state.ui.autoAssign.rmsMax}
                onChange={(e) => handleConfigChange('rmsMax', Number(e.target.value))}
              />
            </div>
          </label>
          <label className="field">
            <div className="status">RMS_GOOD (m): {state.ui.autoAssign.rmsGood}</div>
            <div className="field-controls">
              <input
                type="range"
                min={0.1}
                max={10}
                step={0.1}
                value={state.ui.autoAssign.rmsGood}
                onChange={(e) => handleConfigChange('rmsGood', Number(e.target.value))}
              />
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={state.ui.autoAssign.rmsGood}
                onChange={(e) => handleConfigChange('rmsGood', Number(e.target.value))}
              />
            </div>
          </label>
          <label className="field">
            <div className="status">MAX_SHIFT_M (m): {state.ui.autoAssign.maxShiftM}</div>
            <div className="field-controls">
              <input
                type="range"
                min={0}
                max={50}
                step={0.5}
                value={state.ui.autoAssign.maxShiftM}
                onChange={(e) => handleConfigChange('maxShiftM', Number(e.target.value))}
              />
              <input
                type="number"
                min={0}
                max={200}
                step={0.5}
                value={state.ui.autoAssign.maxShiftM}
                onChange={(e) => handleConfigChange('maxShiftM', Number(e.target.value))}
              />
            </div>
          </label>
          <label className="field">
            <div className="status">MAX_OBS_PER_OBJECT: {state.ui.autoAssign.maxObsPerObject}</div>
            <div className="field-controls">
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={state.ui.autoAssign.maxObsPerObject}
                onChange={(e) => handleConfigChange('maxObsPerObject', Number(e.target.value))}
              />
              <input
                type="number"
                min={1}
                max={20}
                step={1}
                value={state.ui.autoAssign.maxObsPerObject}
                onChange={(e) => handleConfigChange('maxObsPerObject', Number(e.target.value))}
              />
            </div>
          </label>
          <label className="field">
            <div className="status">MIN_ANGLE_DIFF (°): {state.ui.autoAssign.minAngleDiff}</div>
            <div className="field-controls">
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={state.ui.autoAssign.minAngleDiff}
                onChange={(e) => handleConfigChange('minAngleDiff', Number(e.target.value))}
              />
              <input
                type="number"
                min={0}
                max={180}
                step={1}
                value={state.ui.autoAssign.minAngleDiff}
                onChange={(e) => handleConfigChange('minAngleDiff', Number(e.target.value))}
              />
            </div>
          </label>
        </div>
        <div className="button-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => runAutoAssign('active')}
            disabled={!state.activeObjectId || !hasDetections || isRunning}
          >
            Auto-assign (objet actif)
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => runAutoAssign('all')}
            disabled={!hasDetections || isRunning}
          >
            Auto-assign (tous les objets)
          </button>
        </div>
        {progress && (
          <div className="progress-row">
            <div className="status" style={{ margin: 0 }}>
              Calcul {progress.mode === 'all' ? 'tous objets' : 'objet actif'} : {progress.current}/{progress.total}
            </div>
            <progress className="progress-bar" max={progress.total} value={progress.current} />
          </div>
        )}
      </div>
    </div>
  );
}
