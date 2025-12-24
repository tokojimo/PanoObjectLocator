import { useStore } from '../state/store';

export default function SaveStatus() {
  const { state } = useStore();
  return (
    <div className="status">
      Statut sauvegarde: {state.save.status}
      {state.save.lastSavedAt && <span> • Dernière: {state.save.lastSavedAt}</span>}
    </div>
  );
}
