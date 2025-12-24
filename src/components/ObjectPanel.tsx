import { useMemo } from 'react';
import { useStore } from '../state/store';

export default function ObjectPanel() {
  const { state, dispatch } = useStore();
  const objects = useMemo(() => Object.values(state.objectsById), [state.objectsById]);

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
    </div>
  );
}
