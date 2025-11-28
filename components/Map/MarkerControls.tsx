'use client';

import { Marker, Popup, useMapEvents } from 'react-leaflet';
import { Icon } from 'leaflet';
import type { LatLng, MapMarker } from '@/types/map';

interface MarkerControlsProps {
  markers: MapMarker[];
  onMarkerAdd: (position: LatLng, type: 'start' | 'end') => void;
  onMarkerMove: (id: string, position: LatLng) => void;
}

// Fix for default marker icons in Next.js
const createIcon = (color: string) => new Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path fill="${color}" stroke="#fff" stroke-width="2" d="M12 0C5.4 0 0 5.4 0 12c0 8.1 12 24 12 24s12-15.9 12-24C24 5.4 18.6 0 12 0z"/>
      <circle fill="#fff" cx="12" cy="12" r="5"/>
    </svg>
  `)}`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
});

const icons = {
  start: createIcon('#22c55e'), // green
  end: createIcon('#ef4444'),   // red
  waypoint: createIcon('#f97316'), // orange
};

export default function MarkerControls({ markers, onMarkerAdd, onMarkerMove }: MarkerControlsProps) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      const startMarker = markers.find(m => m.type === 'start');
      const endMarker = markers.find(m => m.type === 'end');

      if (!startMarker) {
        onMarkerAdd({ lat, lng }, 'start');
      } else if (!endMarker) {
        onMarkerAdd({ lat, lng }, 'end');
      }
    },
  });

  return (
    <>
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.position.lat, marker.position.lng]}
          icon={icons[marker.type]}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onMarkerMove(marker.id, { lat, lng });
            },
          }}
        >
          <Popup>
            {marker.type === 'start' && 'Начальная точка'}
            {marker.type === 'end' && 'Конечная точка'}
            {marker.type === 'waypoint' && 'Промежуточная точка'}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
