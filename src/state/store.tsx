import React, { useContext, useMemo, useReducer } from 'react';
import type { Detection, Observation, Pano, ProjectObjectsState } from '../types';
import { triangulate } from '../geo/triangulation';
import { buildColorMap } from './colors';
import { nowIso } from '../utils/time';

export type SourceState = {
  imageDirectory?: FileSystemDirectoryHandle;
  boxesHandle?: FileSystemFileHandle;
  metadataHandle?: FileSystemFileHandle;
  projectHandle?: FileSystemFileHandle;
  projectDelimiter?: string;
};

export type UIState = {
  openPanos: string[];
  statusMessage?: string;
  highlight?: { pano_id: string; detection_id: string };
};

export type SaveState = {
  status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  lastSavedAt?: string;
  error?: string;
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
  | {
      type: 'setData';
      payload: {
        panos: Pano[];
        detections: Detection[];
        project?: {
          observationsByObjectId: Record<string, Observation[]>;
          objectsById: ProjectObjectsState;
          delimiter?: string;
        };
      };
    }
  | { type: 'setActiveObject'; payload?: string }
  | { type: 'addObject' }
  | { type: 'addObservation'; payload: Observation }
  | { type: 'removeObservation'; payload: { object_id: string; detection_id: string } }
  | { type: 'reassignObservation'; payload: { from: string; to: string; detection_id: string; observation: Observation } }
  | { type: 'openPano'; payload: string }
  | { type: 'closePano'; payload: string }
  | { type: 'setHighlight'; payload?: { pano_id: string; detection_id: string } }
  | { type: 'setSaveState'; payload: Partial<SaveState> }
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

function recomputeObjects(state: AppState, observationsByObjectId: Record<string, Observation[]>): ProjectObjectsState {
  const ids = new Set([...Object.keys(state.objectsById), ...Object.keys(observationsByObjectId)]);
  const orderedIds = [...Object.keys(state.objectsById), ...[...ids].filter((id) => !state.objectsById[id])];
  const colors = buildColorMap(orderedIds);
  const objects: ProjectObjectsState = {};

  ids.forEach((objectId) => {
    const observations = observationsByObjectId[objectId] ?? [];
    const result = observations.length >= 2 ? triangulate(observations) : undefined;
    objects[objectId] = {
      object_id: objectId,
      color: state.objectsById[objectId]?.color ?? colors[objectId],
      obj_lat: result?.lat,
      obj_lng: result?.lng,
      n_obs: observations.length,
      rms_m: result?.rms,
      updated_at: nowIso(),
    };
  });
  return objects;
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'setSources':
      return { ...state, sources: { ...state.sources, ...action.payload } };
    case 'setData': {
      const { panos, detections, project } = action.payload;
      const panosById = Object.fromEntries(panos.map((p) => [p.pano_id, p]));
      const detectionsById = Object.fromEntries(detections.map((d) => [d.detection_id, d]));
      const observationsByObjectId = project?.observationsByObjectId ?? {};
      const objectsById = recomputeObjects(
        { ...state, panosById, detectionsById, objectsById: project?.objectsById ?? {} },
        observationsByObjectId
      );
      return {
        ...state,
        panosById,
        detectionsById,
        observationsByObjectId,
        objectsById,
        save: { status: 'idle', lastSavedAt: undefined },
      };
    }
    case 'setActiveObject':
      return { ...state, activeObjectId: action.payload };
    case 'addObject': {
      const nextId = Object.keys(state.objectsById).length + 1;
      const id = `obj-${nextId}`;
      const colorMap = buildColorMap([...Object.keys(state.objectsById), id]);
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
        save: { ...state.save, status: 'dirty', error: undefined },
      };
    }
    case 'addObservation': {
      const obs = action.payload;
      const list = state.observationsByObjectId[obs.object_id] ?? [];
      const observationsByObjectId = {
        ...state.observationsByObjectId,
        [obs.object_id]: [...list, obs],
      };
      return {
        ...state,
        observationsByObjectId,
        objectsById: recomputeObjects(state, observationsByObjectId),
        save: { ...state.save, status: 'dirty', error: undefined },
      };
    }
    case 'removeObservation': {
      const { object_id, detection_id } = action.payload;
      const list = state.observationsByObjectId[object_id] ?? [];
      const observationsByObjectId = {
        ...state.observationsByObjectId,
        [object_id]: list.filter((o) => o.detection_id !== detection_id),
      };
      return {
        ...state,
        observationsByObjectId,
        objectsById: recomputeObjects(state, observationsByObjectId),
        save: { ...state.save, status: 'dirty', error: undefined },
      };
    }
    case 'reassignObservation': {
      const { from, to, detection_id, observation } = action.payload;
      const fromList = (state.observationsByObjectId[from] ?? []).filter((o) => o.detection_id !== detection_id);
      const toList = [...(state.observationsByObjectId[to] ?? []), observation];
      const observationsByObjectId = {
        ...state.observationsByObjectId,
        [from]: fromList,
        [to]: toList,
      };
      return {
        ...state,
        observationsByObjectId,
        objectsById: recomputeObjects(state, observationsByObjectId),
        save: { ...state.save, status: 'dirty', error: undefined },
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
    case 'setHighlight':
      return { ...state, ui: { ...state.ui, highlight: action.payload } };
    case 'setSaveState':
      return { ...state, save: { ...state.save, ...action.payload } };
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
