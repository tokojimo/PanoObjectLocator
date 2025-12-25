import { useStore } from '../state/store';
import { PanoCard } from './PanoCard';

export default function PanoDock() {
  const { state } = useStore();
  const openPanos = state.ui.openPanos;
  const opened = openPanos.map((panoId) => state.panosById[panoId]).filter(Boolean);
  const missing = openPanos.filter((panoId) => !state.panosById[panoId]);
  if (missing.length) {
    console.warn('Panos manquants dans le store', { openPanos, known: Object.keys(state.panosById).slice(0, 5) });
  }
  if (!opened.length) return <p className="status">Cliquez un pano sur la carte pour l'ouvrir.</p>;

  const columns = Math.min(opened.length, 3);
  return (
    <div className="dock-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {opened.map((pano) => (
        <PanoCard key={pano!.pano_id} pano={pano!} />
      ))}
    </div>
  );
}
