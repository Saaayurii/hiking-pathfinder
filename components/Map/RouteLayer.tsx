'use client';

import { Polyline } from 'react-leaflet';
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
    <Polyline
      positions={positions}
      color="#3b82f6"
      weight={5}
      opacity={0.8}
    />
  );
}
