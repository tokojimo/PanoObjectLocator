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
  bearing_deg: number;
};

export type ProjectObject = {
  object_id: string;
  color: string;
  lat?: number;
  lng?: number;
  n_obs: number;
  rms_m?: number;
};

export type ProjectObjectsState = Record<string, ProjectObject>;

export type ProjectHandles = {
  boxes?: FileSystemFileHandle;
  metadata?: FileSystemFileHandle;
  project?: FileSystemFileHandle;
  imageDirectory?: FileSystemDirectoryHandle;
};
