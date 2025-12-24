export type Pano = {
  pano_id: string;
  lat: number;
  lng: number;
  heading: number;
  imageWidth: number;
  imageHeight: number;
  imageFileHandle?: FileSystemFileHandle;
  imageUrl?: string;
};

export type Detection = {
  detection_id: string;
  pano_id: string;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  score?: number;
};

export type Observation = {
  obs_id: string;
  object_id: string;
  detection_id: string;
  pano_id: string;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  cx: number;
  bearing_deg: number;
  pano_lat: number;
  pano_lng: number;
  created_at: string;
};

export type ProjectObject = {
  object_id: string;
  color: string;
  obj_lat?: number;
  obj_lng?: number;
  n_obs: number;
  rms_m?: number;
  updated_at?: string;
};

export type ProjectObjectsState = Record<string, ProjectObject>;

export type ProjectHandles = {
  boxes?: FileSystemFileHandle;
  metadata?: FileSystemFileHandle;
  project?: FileSystemFileHandle;
  imageDirectory?: FileSystemDirectoryHandle;
};
