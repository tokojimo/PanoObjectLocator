import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { selectPanos } from '../state/selectors';
import { useStore } from '../state/store';

export default function MapView() {
  const { state, dispatch } = useStore();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    mapRef.current = L.map(containerRef.current).setView([48.8566, 2.3522], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapRef.current);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const layerGroup = L.layerGroup().addTo(mapRef.current);
    const panos = selectPanos(state);
    panos.forEach((pano) => {
      const marker = L.circleMarker([pano.lat, pano.lng], {
        radius: 6,
        color: '#0ea5e9',
        fillOpacity: 0.8,
      }).addTo(layerGroup);
      marker.bindTooltip(pano.pano_id);
      marker.on('click', () => dispatch({ type: 'openPano', payload: pano.pano_id }));
    });

    if (panos.length) {
      const bounds = L.latLngBounds(panos.map((p) => [p.lat, p.lng] as [number, number]));
      mapRef.current.fitBounds(bounds.pad(0.2));
    }

    return () => {
      layerGroup.remove();
    };
  }, [state, dispatch]);

  return <div ref={containerRef} className="map-container" />;
}
