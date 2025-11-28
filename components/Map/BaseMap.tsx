'use client';

import { MapContainer, TileLayer } from 'react-leaflet';
import type { LatLng } from '@/types/map';
import 'leaflet/dist/leaflet.css';

interface BaseMapProps {
  center: LatLng;
  zoom: number;
  children?: React.ReactNode;
}

export default function BaseMap({ center, zoom, children }: BaseMapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom={true}
      className="w-full h-full"
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
      />
      {children}
    </MapContainer>
  );
}
