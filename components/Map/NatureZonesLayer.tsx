'use client';

import { useEffect, useState, useCallback } from 'react';
import { Polygon, Pane, useMap } from 'react-leaflet';

export interface NatureZone {
  id: number;
  type: 'water' | 'forest' | 'wetland' | 'grassland';
  name?: string;
  geometry: Array<{ lat: number; lng: number }>;
}

interface NatureZonesLayerProps {
  enabled: boolean;
}

// Colors for different zone types
const ZONE_COLORS: Record<NatureZone['type'], string> = {
  water: '#3b82f6',      // Blue
  forest: '#22c55e',     // Green
  wetland: '#06b6d4',    // Cyan (blue-green)
  grassland: '#84cc16',  // Light green
};

const ZONE_OPACITY: Record<NatureZone['type'], number> = {
  water: 0.4,
  forest: 0.35,
  wetland: 0.35,
  grassland: 0.25,
};

const ZONE_LABELS: Record<NatureZone['type'], string> = {
  water: 'Водоём',
  forest: 'Лес',
  wetland: 'Болото',
  grassland: 'Луг',
};

export default function NatureZonesLayer({ enabled }: NatureZonesLayerProps) {
  const map = useMap();
  const [zones, setZones] = useState<NatureZone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastBounds, setLastBounds] = useState<string | null>(null);

  // Fetch zones for current map bounds
  const fetchZones = useCallback(async () => {
    if (!enabled) return;

    const bounds = map.getBounds();
    const boundsKey = `${bounds.getSouth().toFixed(4)},${bounds.getWest().toFixed(4)},${bounds.getNorth().toFixed(4)},${bounds.getEast().toFixed(4)}`;

    // Don't refetch if bounds haven't changed much
    if (boundsKey === lastBounds) return;

    setIsLoading(true);
    setLastBounds(boundsKey);

    try {
      const response = await fetch('/api/nature-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.zones) {
        setZones(data.data.zones);
        console.log(`🌲 Loaded ${data.data.zones.length} nature zones`);
      }
    } catch (error) {
      console.error('Failed to fetch nature zones:', error);
    } finally {
      setIsLoading(false);
    }
  }, [map, enabled, lastBounds]);

  // Fetch on mount and map move
  useEffect(() => {
    if (!enabled) {
      setZones([]);
      return;
    }

    fetchZones();

    const handleMoveEnd = () => {
      fetchZones();
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
    };
  }, [map, enabled, fetchZones]);

  if (!enabled || zones.length === 0) {
    return null;
  }

  return (
    <Pane name="nature-zones-pane" style={{ zIndex: 400 }}>
      {zones.map((zone) => {
        if (zone.geometry.length < 3) return null;

        const positions: [number, number][] = zone.geometry.map(point => [
          point.lat,
          point.lng,
        ]);

        const color = ZONE_COLORS[zone.type];
        const opacity = ZONE_OPACITY[zone.type];

        return (
          <Polygon
            key={`zone-${zone.type}-${zone.id}`}
            positions={positions}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: opacity,
              weight: 1,
              opacity: 0.6,
            }}
          />
        );
      })}
    </Pane>
  );
}

// Export constants for use in legend
export { ZONE_COLORS, ZONE_LABELS, ZONE_OPACITY };
