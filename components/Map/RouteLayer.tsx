'use client';

import { Polyline } from 'react-leaflet';
import type { RoutePoint } from '@/types/route';

interface RouteLayerProps {
  route: RoutePoint[];
}

export default function RouteLayer({ route }: RouteLayerProps) {
  if (!route || route.length === 0) {
    console.log('⚠️  RouteLayer: No route data');
    return null;
  }

  const positions: [number, number][] = route.map(point => [point.lat, point.lng]);

  console.log('🗺️  RouteLayer rendering:', {
    points: route.length,
    firstPoint: positions[0],
    lastPoint: positions[positions.length - 1]
  });

  return (
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
  );
}
