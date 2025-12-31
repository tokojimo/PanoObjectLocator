import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { selectPanos } from '../state/selectors';
import { useStore } from '../state/store';

export default function MapView() {
  const { state, dispatch } = useStore();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panoLayerRef = useRef<L.LayerGroup | null>(null);
  const objectLayerRef = useRef<L.LayerGroup | null>(null);
  const rayLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    mapRef.current = L.map(containerRef.current).setView([48.8566, 2.3522], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapRef.current);
    panoLayerRef.current = L.layerGroup().addTo(mapRef.current);
    objectLayerRef.current = L.layerGroup().addTo(mapRef.current);
    rayLayerRef.current = L.layerGroup().addTo(mapRef.current);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !panoLayerRef.current) return;
    const layer = panoLayerRef.current;
    layer.clearLayers();
    const panos = selectPanos(state);
    panos.forEach((pano) => {
      const marker = L.circleMarker([pano.lat, pano.lng], {
        radius: 6,
        color: '#0ea5e9',
        fillOpacity: 0.8,
      }).addTo(layer);
      marker.bindTooltip(pano.pano_id);
      marker.on('click', () => dispatch({ type: 'openPano', payload: pano.pano_id }));
    });

    const bounds = L.latLngBounds([
      ...panos.map((p) => [p.lat, p.lng] as [number, number]),
      ...Object.values(state.objectsById)
        .filter((o) => o.obj_lat !== undefined && o.obj_lng !== undefined)
        .map((o) => [o.obj_lat!, o.obj_lng!] as [number, number]),
    ]);
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.2));
    }
  }, [state.panosById, state.objectsById, dispatch, state.observationsByObjectId]);

  useEffect(() => {
    if (!mapRef.current || !objectLayerRef.current || !rayLayerRef.current) return;
    const layer = objectLayerRef.current;
    const rayLayer = rayLayerRef.current;
    layer.clearLayers();
    rayLayer.clearLayers();

    Object.values(state.objectsById).forEach((obj) => {
      if (obj.obj_lat === undefined || obj.obj_lng === undefined) return;
      const marker = L.circleMarker([obj.obj_lat, obj.obj_lng], {
        radius: 7,
        color: obj.color,
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(layer);
      marker.bindTooltip(`${obj.object_id} • ${obj.n_obs} obs${obj.rms_m ? ` • RMS ${obj.rms_m.toFixed(1)}m` : ''}`);

      const observations = state.observationsByObjectId[obj.object_id] ?? [];
      observations.forEach((obs) => {
        const pano = state.panosById[obs.pano_id];
        if (!pano) return;
        L.polyline(
          [
            [pano.lat, pano.lng],
            [obj.obj_lat!, obj.obj_lng!],
          ],
          {
            color: obj.color,
            weight: 2,
            opacity: 0.9,
          }
        ).addTo(rayLayer);
      });
    });
  }, [state.objectsById, state.observationsByObjectId, state.panosById]);

  return <div ref={containerRef} className="map-container" />;
}
