import { saveProject } from '../data/projectIO';
import { useStore } from '../state/store';
import { nowIso } from '../utils/time';

export default function SaveStatus() {
  const { state, dispatch } = useStore();

  const onSave = async () => {
    try {
      dispatch({ type: 'setSaveState', payload: { status: 'saving', error: undefined } });
      const handle = await saveProject(state);
      dispatch({ type: 'setSources', payload: { projectHandle: handle } });
      dispatch({ type: 'setSaveState', payload: { status: 'saved', lastSavedAt: nowIso() } });
    } catch (err: any) {
      dispatch({ type: 'setSaveState', payload: { status: 'error', error: err?.message ?? 'Erreur de sauvegarde' } });
    }
  };

  const statusLabel =
    state.save.status === 'dirty'
      ? 'Non enregistré'
      : state.save.status === 'saved'
      ? 'Enregistré'
      : state.save.status === 'saving'
      ? 'Enregistrement…'
      : state.save.status;

  return (
    <div className="panel">
      <h3>Sauvegarde</h3>
      <div className="status">Statut sauvegarde: {statusLabel}</div>
      {state.save.lastSavedAt && <div className="status">Dernière: {state.save.lastSavedAt}</div>}
      {state.save.error && <div className="status error">{state.save.error}</div>}
      <button type="button" onClick={onSave} disabled={state.save.status === 'saving'}>
        Enregistrer
      </button>
    </div>
  );
}
