'use client';

import { Polygon, Polyline, Popup, Tooltip } from 'react-leaflet';
import type { TerrainFeature } from '@/types/route';
import { getCoefficientColor, getCoefficientLabel } from '@/lib/terrain/coefficients';

interface TerrainZonesLayerProps {
  features: TerrainFeature[];
  showLabels?: boolean;
}

// Detailed color mapping based on terrain type and passability
const getTerrainStyle = (feature: TerrainFeature) => {
  const { type, passable, coefficient } = feature;

  // Use coefficient-based color for gradient effect
  const baseColor = getCoefficientColor(coefficient);

  // Opacity based on passability
  const fillOpacity = passable ? 0.25 : 0.5;
  const strokeOpacity = passable ? 0.6 : 0.9;
  const weight = passable ? 1 : 2;

  // Special colors for certain types
  let color = baseColor;

  switch (type) {
    case 'water':
    case 'waterway':
      color = '#1E90FF'; // Blue
      break;
    case 'wetland':
      color = '#4682B4'; // Steel blue
      break;
    case 'building':
      color = '#8B4513'; // Brown
      break;
    case 'forest':
      color = '#228B22'; // Forest green
      break;
    case 'path':
    case 'footway':
    case 'track':
      color = '#FFD700'; // Gold - paths are easy
      break;
  }

  return {
    color,
    fillColor: color,
    fillOpacity,
    weight,
    opacity: strokeOpacity,
    dashArray: passable ? undefined : '5, 5', // Dashed for impassable
  };
};

// Human-readable terrain names in Russian
const TERRAIN_NAMES: Record<string, string> = {
  building: 'Здание',
  wall: 'Стена',
  fence: 'Забор',
  water: 'Водоём',
  waterway: 'Река/Ручей',
  wetland: 'Болото',
  forest: 'Лес',
  grassland: 'Луг',
  scrub: 'Кустарник',
  rock: 'Скалы',
  path: 'Тропа',
  footway: 'Пешеходная дорожка',
  track: 'Грунтовая дорога',
  steps: 'Ступени',
  residential: 'Жилая улица',
  cliff: 'Обрыв',
  railway: 'Железная дорога',
  construction: 'Строительство',
  unknown: 'Неизвестно',
};

export default function TerrainZonesLayer({ features, showLabels = true }: TerrainZonesLayerProps) {
  if (!features || features.length === 0) {
    return null;
  }

  // Sort features: impassable first (so they render on top)
  const sortedFeatures = [...features].sort((a, b) => {
    if (a.passable && !b.passable) return -1;
    if (!a.passable && b.passable) return 1;
    return b.coefficient - a.coefficient;
  });

  return (
    <>
      {sortedFeatures.map((feature, index) => {
        const positions: [number, number][] = feature.geometry.map(point => [
          point.lat,
          point.lng,
        ]);

        const style = getTerrainStyle(feature);
        const terrainName = TERRAIN_NAMES[feature.type] || feature.type;
        const passabilityText = feature.passable ? 'Проходимо' : 'Непроходимо';
        const coefficientLabel = getCoefficientLabel(feature.coefficient);

        // Determine if this is a polygon (closed) or polyline
        const isPolygon = feature.geometry.length >= 3 &&
          feature.geometry[0].lat === feature.geometry[feature.geometry.length - 1].lat &&
          feature.geometry[0].lng === feature.geometry[feature.geometry.length - 1].lng;

        const key = `terrain-zone-${feature.type}-${index}`;

        if (isPolygon) {
          return (
            <Polygon
              key={key}
              positions={positions}
              pathOptions={style}
            >
              {showLabels && (
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-base mb-1">{terrainName}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: style.color }}
                        />
                        <span>{passabilityText}</span>
                      </div>
                      <div className="text-gray-600">
                        Коэффициент: {feature.coefficient.toFixed(1)}
                      </div>
                      <div className="text-gray-600">
                        {coefficientLabel}
                      </div>
                      {feature.tags?.name && (
                        <div className="text-gray-500 italic">
                          {feature.tags.name}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              )}
            </Polygon>
          );
        }

        // For lines (paths, rivers, etc.)
        return (
          <Polyline
            key={key}
            positions={positions}
            pathOptions={{
              ...style,
              weight: Math.max(style.weight, 2),
            }}
          >
            {showLabels && (
              <Popup>
                <div className="text-sm">
                  <div className="font-bold text-base mb-1">{terrainName}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: style.color }}
                      />
                      <span>{passabilityText}</span>
                    </div>
                    <div className="text-gray-600">
                      Коэффициент: {feature.coefficient.toFixed(1)}
                    </div>
                    <div className="text-gray-600">
                      {coefficientLabel}
                    </div>
                    {feature.tags?.name && (
                      <div className="text-gray-500 italic">
                        {feature.tags.name}
                      </div>
                    )}
                    {feature.tags?.surface && (
                      <div className="text-gray-500">
                        Покрытие: {feature.tags.surface}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            )}
          </Polyline>
        );
      })}
    </>
  );
}
