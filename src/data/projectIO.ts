import { Detection, Observation, Pano, ProjectObject, ProjectObjectsState } from '../types';
import { makeDetectionId, makeObservationId } from '../utils/ids';
import { nowIso } from '../utils/time';
import { parseCsvFile, parseWithSchema } from './csv';
import { BOX_COLUMNS, META_COLUMNS, META_ALIASES, PROJECT_COLUMNS } from './schema';
import { triangulate } from '../geo/triangulation';
import { buildColorMap } from '../state/colors';

export type ProjectData = {
  panos: Pano[];
  detections: Detection[];
  project?: { observationsByObjectId: Record<string, Observation[]>; objectsById: ProjectObjectsState };
};

function computeObjects(observationsByObjectId: Record<string, Observation[]>, existing?: ProjectObjectsState) {
  const ids = new Set([...Object.keys(existing ?? {}), ...Object.keys(observationsByObjectId)]);
  const orderedIds = [...(existing ? Object.keys(existing) : []), ...[...ids].filter((id) => !(existing ?? {})[id])];
  const colors = buildColorMap(orderedIds);
  const objects: ProjectObjectsState = {};
  ids.forEach((objectId) => {
    const obs = observationsByObjectId[objectId] ?? [];
    const result = obs.length >= 2 ? triangulate(obs) : undefined;
    objects[objectId] = {
      object_id: objectId,
      color: existing?.[objectId]?.color ?? colors[objectId],
      obj_lat: result?.lat,
      obj_lng: result?.lng,
      n_obs: obs.length,
      rms_m: result?.rms,
      updated_at: nowIso(),
    };
  });
  return objects;
}

async function resolveImageHandle(directory: FileSystemDirectoryHandle | undefined, panoId: string) {
  if (!directory) return undefined;
  const target = `${panoId}`.toLowerCase();
  const candidates = new Set([`${target}.jpg`, `${target}.jpeg`, `${target}.png`]);
  for await (const entry of directory.values()) {
    if (entry.kind === 'file' && candidates.has(entry.name.toLowerCase())) {
      return directory.getFileHandle(entry.name);
    }
  }
  return undefined;
}

export async function loadBoxes(handle: FileSystemFileHandle | File): Promise<Detection[]> {
  const rows = await parseWithSchema<Detection>(handle, BOX_COLUMNS);
  return rows.map((row) => ({
    ...row,
    detection_id: makeDetectionId(row.pano_id, row.xmin, row.ymin, row.xmax, row.ymax, row.score),
  }));
}

export async function loadMetadata(handle: FileSystemFileHandle | File, directory?: FileSystemDirectoryHandle) {
  const rows = await parseCsvFile<Record<string, any>>(handle);
  const panos: Pano[] = [];
  for (const raw of rows) {
    const normalized: Record<string, any> = {};
    Object.entries(raw).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value;
    });

    const resolveValue = (field: string) => {
      const candidates = [field, ...(META_ALIASES[field] ?? [])];
      for (const candidate of candidates) {
        const v = normalized[candidate.toLowerCase()];
        if (v !== undefined && v !== null && v !== '') return v as number;
      }
      return undefined;
    };

    const panoId = (normalized['pano_id'] ?? normalized['panoid']) as string;
    const lat = Number(resolveValue('lat'));
    const lng = Number(resolveValue('lon'));
    const heading = Number(normalized['heading'] ?? 0);
    const imageWidth = Number(resolveValue('imageWidth'));
    const imageHeight = Number(resolveValue('imageHeight'));
    if (!panoId || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(imageWidth) || Number.isNaN(imageHeight)) {
      throw new Error('Métadonnées pano incomplètes dans le CSV.');
    }

    const imageFileHandle = await resolveImageHandle(directory, panoId);
    panos.push({
      pano_id: panoId,
      lat,
      lng,
      heading,
      imageWidth,
      imageHeight,
      imageFileHandle,
    });
  }
  return panos;
}

export async function loadProject(handle: FileSystemFileHandle | File) {
  const rows = await parseCsvFile<Record<string, any>>(handle);
  const observationsByObjectId: Record<string, Observation[]> = {};
  const objectsById: ProjectObjectsState = {};
  rows.forEach((row) => {
    if (String(row.row_type).toUpperCase() === 'OBS') {
      const obs: Observation = {
        obs_id: String(row.obs_id ?? makeObservationId()),
        object_id: String(row.object_id),
        detection_id: String(row.detection_id ?? ''),
        pano_id: String(row.pano_id),
        xmin: Number(row.xmin ?? 0),
        ymin: Number(row.ymin ?? 0),
        xmax: Number(row.xmax ?? 0),
        ymax: Number(row.ymax ?? 0),
        cx: Number(row.cx ?? (Number(row.xmin ?? 0) + Number(row.xmax ?? 0)) / 2),
        bearing_deg: Number(row.bearing_deg ?? 0),
        pano_lat: Number(row.pano_lat ?? row.lat ?? 0),
        pano_lng: Number(row.pano_lng ?? row.lon ?? row.lng ?? 0),
        created_at: String(row.updated_at ?? row.created_at ?? nowIso()),
      };
      observationsByObjectId[obs.object_id] = [...(observationsByObjectId[obs.object_id] ?? []), obs];
    }
    if (String(row.row_type).toUpperCase() === 'OBJ') {
      const obj: ProjectObject = {
        object_id: String(row.object_id),
        color: String(row.color ?? '#0ea5e9'),
        obj_lat: row.obj_lat as number | undefined,
        obj_lng: row.obj_lng as number | undefined,
        n_obs: Number(row.n_obs ?? 0),
        rms_m: row.rms_m as number | undefined,
        updated_at: String(row.updated_at ?? nowIso()),
      };
      objectsById[obj.object_id] = obj;
    }
  });
  const computed = computeObjects(observationsByObjectId, objectsById);
  return { observationsByObjectId, objectsById: computed };
}

function toCsvLine(values: (string | number | undefined)[]) {
  return values
    .map((v) => {
      if (v === undefined) return '';
      const value = String(v);
      return value.includes(',') ? `"${value}"` : value;
    })
    .join(',');
}

export async function saveProject(
  state: { observationsByObjectId: Record<string, Observation[]>; objectsById: ProjectObjectsState; sources: any },
  projectHandle?: FileSystemFileHandle
) {
  let handle = projectHandle ?? state.sources.projectHandle;
  if (!handle) {
    if (!('showSaveFilePicker' in window)) throw new Error('showSaveFilePicker non supporté');
    [handle] = await (window as any).showSaveFilePicker({
      suggestedName: 'pano_project.csv',
      types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
    });
  }

  const headers = [
    'row_type',
    'object_id',
    'pano_id',
    'detection_id',
    'xmin',
    'ymin',
    'xmax',
    'ymax',
    'cx',
    'bearing_deg',
    'pano_lat',
    'pano_lng',
    'obj_lat',
    'obj_lng',
    'n_obs',
    'rms_m',
    'updated_at',
    'color',
  ];

  const lines: string[] = [headers.join(',')];
  Object.entries(state.observationsByObjectId).forEach(([objectId, observations]) => {
    observations.forEach((obs) => {
      lines.push(
        toCsvLine([
          'OBS',
          objectId,
          obs.pano_id,
          obs.detection_id,
          obs.xmin,
          obs.ymin,
          obs.xmax,
          obs.ymax,
          obs.cx,
          obs.bearing_deg,
          obs.pano_lat,
          obs.pano_lng,
          '',
          '',
          '',
          '',
          obs.created_at,
          '',
        ])
      );
    });
  });

  Object.values(state.objectsById).forEach((obj) => {
    lines.push(
      toCsvLine([
        'OBJ',
        obj.object_id,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        obj.obj_lat,
        obj.obj_lng,
        obj.n_obs,
        obj.rms_m,
        obj.updated_at ?? nowIso(),
        obj.color,
      ])
    );
  });

  const writable = await handle.createWritable();
  await writable.write(lines.join('\n'));
  await writable.close();
  return handle;
}
