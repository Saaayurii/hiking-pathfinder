'use client';

import { Polygon } from 'react-leaflet';
import type { TerrainFeature } from '@/types/route';

interface TerrainLayerProps {
  features: TerrainFeature[];
}

// Color mapping for terrain types
const TERRAIN_COLORS: Record<string, string> = {
  building: '#8B4513', // Brown
  barrier: '#696969', // Dark gray
  water: '#1E90FF', // Dodger blue
  railway: '#2F4F4F', // Dark slate gray
  forest: '#228B22', // Forest green
  grassland: '#90EE90', // Light green
  scrub: '#6B8E23', // Olive drab
  rock: '#A9A9A9', // Dark gray
  path: '#FFD700', // Gold
  road: '#D3D3D3', // Light gray
  wetland: '#4682B4', // Steel blue
};

const TERRAIN_OPACITY: Record<string, number> = {
  building: 0.7,
  barrier: 0.6,
  water: 0.5,
  railway: 0.6,
  forest: 0.3,
  grassland: 0.2,
  scrub: 0.3,
  rock: 0.4,
  path: 0.4,
  road: 0.3,
  wetland: 0.4,
};

export default function TerrainLayer({ features }: TerrainLayerProps) {
  if (!features || features.length === 0) {
    console.log('⚠️  TerrainLayer: No features to display');
    return null;
  }

  console.log(`🗺️  TerrainLayer: Rendering ${features.length} terrain features`);

  return (
    <>
      {features.map((feature, index) => {
        if (feature.geometry.length < 3) return null; // Need at least 3 points for polygon

        const positions: [number, number][] = feature.geometry.map(point => [
          point.lat,
          point.lng,
        ]);

        const color = TERRAIN_COLORS[feature.type] || '#808080';
        const opacity = TERRAIN_OPACITY[feature.type] || 0.3;

        return (
          <Polygon
            key={`terrain-${feature.type}-${index}`}
            positions={positions}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: opacity,
              weight: 1,
              opacity: 0.8,
            }}
          />
        );
      })}
    </>
  );
}

export { TERRAIN_COLORS, TERRAIN_OPACITY };
