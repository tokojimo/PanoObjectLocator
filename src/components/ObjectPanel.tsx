import { useMemo, useState } from 'react';
import { AutoAssignConfig, autoAssignObjectsProgressive, previewPanoClusters } from '../state/autoAssign';
import { selectObservationAssignments } from '../state/selectors';
import { useStore } from '../state/store';

export default function ObjectPanel() {
  const { state, dispatch } = useStore();
  const [error, setError] = useState<string | undefined>();
  const [clusterError, setClusterError] = useState<string | undefined>();
  const [isPreviewing, setIsPreviewing] = useState(false);
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
    setError(undefined);
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
    } catch (err) {
      console.error('Auto-assign failed', err);
      const message = err instanceof Error ? err.message : 'Erreur inconnue lors de l\'auto-assign.';
      setError(message);
    } finally {
      dispatch({ type: 'setAutoAssignProgress', payload: null });
    }
  };

  const runClusterPreview = async () => {
    setClusterError(undefined);
    setIsPreviewing(true);
    try {
      const clusters = await Promise.resolve(
        previewPanoClusters(
          {
            panosById: state.panosById,
            detectionsById: state.detectionsById,
            observationsByObjectId: state.observationsByObjectId,
          },
          state.ui.autoAssign
        )
      );

      dispatch({
        type: 'setClusterPreview',
        payload: {
          clusters,
          params: { clusterDistanceM: state.ui.autoAssign.clusterDistanceM },
        },
      });
    } catch (err) {
      console.error('Cluster preview failed', err);
      const message = err instanceof Error ? err.message : 'Erreur inconnue lors du clustering.';
      setClusterError(message);
    } finally {
      setIsPreviewing(false);
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
        {error && (
          <div className="status" style={{ color: '#e11d48', marginBottom: 8 }}>
            {error}
          </div>
        )}
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
          <label className="field">
            <div className="status">
              CLUSTER_DISTANCE_M (m): {state.ui.autoAssign.clusterDistanceM}
            </div>
            <div className="field-controls">
              <input
                type="range"
                min={1}
                max={400}
                step={1}
                value={state.ui.autoAssign.clusterDistanceM}
                onChange={(e) => handleConfigChange('clusterDistanceM', Number(e.target.value))}
              />
              <input
                type="number"
                min={0}
                max={500}
                step={1}
                value={state.ui.autoAssign.clusterDistanceM}
                onChange={(e) => handleConfigChange('clusterDistanceM', Number(e.target.value))}
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
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <div>
            <div className="status" style={{ margin: 0 }}>
              Clustering manuel
            </div>
            <strong>Ajuster avant l'auto-assign</strong>
          </div>
          <span className="badge">
            {state.ui.clusterPreview
              ? `${state.ui.clusterPreview.clusters.length} clusters`
              : 'Pas encore de clustering'}
          </span>
        </div>
        <div className="status" style={{ marginBottom: 8 }}>
          Lancez un clustering avec les paramètres courants pour inspecter les grappes de panos libres.
        </div>
        {clusterError && (
          <div className="status" style={{ color: '#e11d48', marginBottom: 8 }}>
            {clusterError}
          </div>
        )}
        <div className="button-row" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="secondary"
            onClick={runClusterPreview}
            disabled={!hasDetections || isRunning || isPreviewing}
          >
            {isPreviewing ? 'Calcul…' : 'Prévisualiser le clustering'}
          </button>
          {state.ui.clusterPreview && (
            <div className="status" style={{ margin: 0 }}>
              Distance ≤ {state.ui.clusterPreview.params.clusterDistanceM} m — dernière mise à jour :{' '}
              {new Date(state.ui.clusterPreview.updatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
        <label className="status" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <input
            type="checkbox"
            checked={state.ui.showClusterOverlay}
            disabled={!state.ui.clusterPreview}
            onChange={(e) => dispatch({ type: 'setShowClusterOverlay', payload: e.target.checked })}
          />
          Afficher les clusters sur la carte
        </label>
        {state.ui.clusterPreview && (
          <div className="cluster-grid">
            {state.ui.clusterPreview.clusters.slice(0, 20).map((cluster, idx) => (
              <div key={`${cluster.panoIds.join('-')}-${idx}`} className="cluster-card">
                <div className="status" style={{ margin: 0 }}>
                  Cluster #{idx + 1} — score {cluster.score}
                </div>
                <div className="status" style={{ margin: 0 }}>
                  Panos: {cluster.panoIds.length}
                </div>
                <div className="status" style={{ margin: 0 }}>
                  Boxes libres: {cluster.detectionIds.length}
                </div>
              </div>
            ))}
            {state.ui.clusterPreview.clusters.length > 20 && (
              <div className="status" style={{ marginTop: 4 }}>
                ({state.ui.clusterPreview.clusters.length - 20} clusters supplémentaires masqués)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
