import SourcePicker from '../components/SourcePicker';
import MapView from '../components/MapView';
import PanoDock from '../components/PanoDock';
import ObjectPanel from '../components/ObjectPanel';
import SaveStatus from '../components/SaveStatus';
import TodoList from '../components/TodoList';
import { StoreProvider } from '../state/store';

export default function App() {
  return (
    <StoreProvider>
      <div className="app-shell">
        <header style={{ padding: '12px 16px', background: '#f97316', color: 'white' }}>
          <h1 style={{ margin: 0 }}>PanoTriangulator</h1>
          <p style={{ margin: 0, opacity: 0.9 }}>MVP frontend-only (Chrome/Edge)</p>
        </header>
        <div className="main-layout">
          <div className="panel">
            <SourcePicker />
            <ObjectPanel />
            <TodoList />
            <SaveStatus />
          </div>
          <div className="right-panel">
            <MapView />
            <div className="dock-wrapper">
              <PanoDock />
            </div>
          </div>
        </div>
      </div>
    </StoreProvider>
  );
}
