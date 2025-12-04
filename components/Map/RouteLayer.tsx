'use client';

import { Polyline, Pane } from 'react-leaflet';
import type { RoutePoint } from '@/types/route';

interface RouteLayerProps {
  route: RoutePoint[];
}

export default function RouteLayer({ route }: RouteLayerProps) {
  if (!route || route.length === 0) {
    return null;
  }

  const positions: [number, number][] = route.map(point => [point.lat, point.lng]);

  return (
    <Pane name="route-pane" style={{ zIndex: 650 }}>
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#ef4444',
          weight: 6,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round'
        }}
      />
    </Pane>
  );
}
