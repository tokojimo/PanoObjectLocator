import { useEffect, useState } from 'react';
import { Detection, Pano } from '../types';
import { BoxOverlay } from './BoxOverlay';

export function PanoViewer({ pano, detections }: { pano: Pano; detections: Detection[] }) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(pano.imageUrl);

  useEffect(() => {
    let revoked: string | undefined;
    (async () => {
      if (pano.imageFileHandle) {
        const file = await pano.imageFileHandle.getFile();
        const url = URL.createObjectURL(file);
        setImageUrl(url);
        revoked = url;
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [pano.imageFileHandle]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <strong>{pano.pano_id}</strong>
          <span className="badge">Heading {pano.heading}°</span>
        </div>
        {imageUrl ? <img src={imageUrl} alt={pano.pano_id} style={{ width: '100%' }} /> : <p>Image locale non chargée.</p>}
      </div>
      <BoxOverlay detections={detections} onSelect={() => {}} />
    </div>
  );
}
