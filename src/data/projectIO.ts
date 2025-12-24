import { Detection, Observation, Pano, ProjectObject, ProjectObjectsState } from '../types';
import { makeDetectionId } from '../utils/ids';
import { parseWithSchema } from './csv';
import { BOX_COLUMNS, META_COLUMNS, PROJECT_COLUMNS } from './schema';

export type ProjectData = {
  panos: Pano[];
  detections: Detection[];
  project?: { observationsByObjectId: Record<string, Observation[]>; objectsById: ProjectObjectsState };
};

async function resolveImageHandle(directory: FileSystemDirectoryHandle | undefined, panoId: string) {
  if (!directory) return undefined;
  const candidates = [`${panoId}.jpg`, `${panoId}.png`];
  for (const filename of candidates) {
    try {
      return await directory.getFileHandle(filename);
    } catch (err) {
      // continue
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
  const rows = await parseWithSchema<Pano & { lon: number }>(handle, META_COLUMNS);
  const panos: Pano[] = [];
  for (const row of rows) {
    const imageFileHandle = await resolveImageHandle(directory, row.pano_id);
    panos.push({
      pano_id: row.pano_id,
      lat: row.lat,
      lng: row.lon,
      heading: row.heading,
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
      imageFileHandle,
    });
  }
  return panos;
}

export async function loadProject(handle: FileSystemFileHandle | File) {
  const rows = await parseWithSchema<Record<string, string | number>>(handle, PROJECT_COLUMNS);
  const observationsByObjectId: Record<string, Observation[]> = {};
  const objectsById: ProjectObjectsState = {};
  rows.forEach((row) => {
    if (row.row_type === 'OBS') {
      const obs: Observation = {
        obs_id: String(row.obs_id ?? ''),
        object_id: String(row.object_id),
        detection_id: String(row.detection_id ?? ''),
        pano_id: String(row.pano_id),
        bearing_deg: Number(row.bearing_deg ?? 0),
      };
      observationsByObjectId[obs.object_id] = [...(observationsByObjectId[obs.object_id] ?? []), obs];
    }
    if (row.row_type === 'OBJ') {
      const obj: ProjectObject = {
        object_id: String(row.object_id),
        color: String(row.color ?? '#0ea5e9'),
        lat: row.obj_lat as number | undefined,
        lng: row.obj_lng as number | undefined,
        n_obs: Number(row.n_obs ?? 0),
        rms_m: row.rms_m as number | undefined,
      };
      objectsById[obj.object_id] = obj;
    }
  });
  return { observationsByObjectId, objectsById };
}

export async function saveProject() {
  // Placeholder for File System Access API writing; implemented in later iterations.
  throw new Error('Save project not implemented yet');
}
