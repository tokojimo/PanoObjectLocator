import { selectPanos } from '../state/selectors';
import { useStore } from '../state/store';
import { PanoCard } from './PanoCard';

export default function PanoDock() {
  const { state } = useStore();
  const panos = selectPanos(state);
  const openPanos = state.ui.openPanos;
  const opened = openPanos.map((panoId) => panos.find((p) => p.pano_id === panoId)).filter(Boolean);
  if (!opened.length) return <p className="status">Cliquez un pano sur la carte pour l'ouvrir.</p>;
  return (
    <div className="dock-grid">
      {opened.map((pano) => (
        <PanoCard key={pano!.pano_id} pano={pano!} />
      ))}
    </div>
  );
}
