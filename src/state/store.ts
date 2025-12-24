import React, { useContext, useMemo, useReducer } from 'react';
import type { Detection, Observation, Pano, ProjectHandles, ProjectObjectsState } from '../types';
import { buildColorMap } from './colors';

export type SourceState = {
  imageDirectory?: FileSystemDirectoryHandle;
  boxesHandle?: FileSystemFileHandle;
  metadataHandle?: FileSystemFileHandle;
  projectHandle?: FileSystemFileHandle;
};

export type UIState = {
  openPanos: string[];
  statusMessage?: string;
};

export type SaveState = {
  status: 'idle' | 'dirty' | 'saving' | 'error';
  lastSavedAt?: string;
};

export type AppState = {
  sources: SourceState;
  panosById: Record<string, Pano>;
  detectionsById: Record<string, Detection>;
  observationsByObjectId: Record<string, Observation[]>;
  objectsById: ProjectObjectsState;
  activeObjectId?: string;
  ui: UIState;
  save: SaveState;
};

export type AppAction =
  | { type: 'setSources'; payload: Partial<SourceState> }
  | { type: 'setData'; payload: { panos: Pano[]; detections: Detection[]; project?: ProjectObjectsState } }
  | { type: 'setActiveObject'; payload?: string }
  | { type: 'addObject' }
  | { type: 'openPano'; payload: string }
  | { type: 'closePano'; payload: string }
  | { type: 'setStatus'; payload?: string };

const initialState: AppState = {
  sources: {},
  panosById: {},
  detectionsById: {},
  observationsByObjectId: {},
  objectsById: {},
  ui: {
    openPanos: [],
  },
  save: { status: 'idle' },
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'setSources':
      return { ...state, sources: { ...state.sources, ...action.payload } };
    case 'setData': {
      const { panos, detections, project } = action.payload;
      const panosById = Object.fromEntries(panos.map((p) => [p.pano_id, p]));
      const detectionsById = Object.fromEntries(detections.map((d) => [d.detection_id, d]));
      return {
        ...state,
        panosById,
        detectionsById,
        observationsByObjectId: project?.observationsByObjectId ?? {},
        objectsById: project?.objectsById ?? {},
      };
    }
    case 'setActiveObject':
      return { ...state, activeObjectId: action.payload };
    case 'addObject': {
      const nextId = Object.keys(state.objectsById).length + 1;
      const id = `obj-${nextId}`;
      const colorMap = buildColorMap([id, ...Object.keys(state.objectsById)]);
      return {
        ...state,
        activeObjectId: id,
        objectsById: {
          ...state.objectsById,
          [id]: {
            object_id: id,
            color: colorMap[id],
            n_obs: 0,
            rms_m: undefined,
          },
        },
      };
    }
    case 'openPano':
      if (state.ui.openPanos.includes(action.payload)) return state;
      return { ...state, ui: { ...state.ui, openPanos: [...state.ui.openPanos, action.payload] } };
    case 'closePano':
      return {
        ...state,
        ui: { ...state.ui, openPanos: state.ui.openPanos.filter((p) => p !== action.payload) },
      };
    case 'setStatus':
      return { ...state, ui: { ...state.ui, statusMessage: action.payload } };
    default:
      return state;
  }
}

const StoreContext = React.createContext<{ state: AppState; dispatch: React.Dispatch<AppAction> } | undefined>(
  undefined
);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('StoreProvider missing');
  return ctx;
}
