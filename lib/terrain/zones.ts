import type { TerrainZone } from '@/types/terrain';
import { calculateTerrainCoefficient } from './coefficients';
import { classifyFeature } from '../osm/parser';
import { parseTrailAttributes } from '../osm/overpass';

/**
 * Automatic terrain zoning system
 * Analyzes OSM data and creates walkability zones
 */

/**
 * Create terrain zone from OSM feature
 */
export function createZoneFromFeature(
  feature: {
    id: number;
    tags: Record<string, string>;
    coordinates: Array<{ lat: number; lng: number }>;
  },
  elevationData?: {
    avgElevation: number;
    avgSlope: number;
  }
): Omit<TerrainZone, 'id' | 'createdAt'> {
  const attributes = parseTrailAttributes(feature.tags);
  const terrainType = classifyFeature(feature.tags) as any;

  const coefficient = calculateTerrainCoefficient({
    surface: attributes.surface,
    visibility: attributes.visibility,
    smoothness: attributes.smoothness,
    informal: attributes.informal,
    width: attributes.width,
    slope: elevationData?.avgSlope,
  });

  // Convert coordinates to GeoJSON polygon
  const bounds = createPolygonFromLine(feature.coordinates);

  return {
    bounds,
    terrainType,
    coefficient,
    avgElevation: elevationData?.avgElevation,
    avgSlope: elevationData?.avgSlope,
    visibility: attributes.visibility as any,
    smoothness: attributes.smoothness as any,
    width: attributes.width,
    informal: attributes.informal,
    surface: attributes.surface,
  };
}

/**
 * Create polygon from line with buffer
 */
function createPolygonFromLine(
  coordinates: Array<{ lat: number; lng: number }>,
  bufferMeters: number = 5
): GeoJSON.Polygon {
  // Simple buffer: create polygon around line
  // For production, use turf.js buffer function

  if (coordinates.length < 2) {
    // Return a small polygon around single point
    const p = coordinates[0];
    const offset = 0.0001; // ~11 meters
    return {
      type: 'Polygon',
      coordinates: [
        [
          [p.lng - offset, p.lat - offset],
          [p.lng + offset, p.lat - offset],
          [p.lng + offset, p.lat + offset],
          [p.lng - offset, p.lat + offset],
          [p.lng - offset, p.lat - offset],
        ],
      ],
    };
  }

  // Simple rectangular buffer around line
  const lats = coordinates.map((c) => c.lat);
  const lngs = coordinates.map((c) => c.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const offset = bufferMeters / 111000; // Convert meters to degrees

  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLng - offset, minLat - offset],
        [maxLng + offset, minLat - offset],
        [maxLng + offset, maxLat + offset],
        [minLng - offset, maxLat + offset],
        [minLng - offset, minLat - offset],
      ],
    ],
  };
}

/**
 * Classify area into grid-based zones
 */
export function createGridZones(
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  },
  gridSizeMeters: number = 50
): Array<{
  lat: number;
  lng: number;
  bounds: GeoJSON.Polygon;
}> {
  const zones: Array<{
    lat: number;
    lng: number;
    bounds: GeoJSON.Polygon;
  }> = [];

  // Convert grid size to degrees
  const latStep = gridSizeMeters / 111000;
  const lngStep = gridSizeMeters / (111000 * Math.cos((bounds.north * Math.PI) / 180));

  // Create grid
  for (let lat = bounds.south; lat < bounds.north; lat += latStep) {
    for (let lng = bounds.west; lng < bounds.east; lng += lngStep) {
      zones.push({
        lat: lat + latStep / 2,
        lng: lng + lngStep / 2,
        bounds: {
          type: 'Polygon',
          coordinates: [
            [
              [lng, lat],
              [lng + lngStep, lat],
              [lng + lngStep, lat + latStep],
              [lng, lat + latStep],
              [lng, lat],
            ],
          ],
        },
      });
    }
  }

  return zones;
}

/**
 * Find which zone a point belongs to
 */
export function findZoneForPoint(
  point: { lat: number; lng: number },
  zones: TerrainZone[]
): TerrainZone | undefined {
  return zones.find((zone) => isPointInPolygon(point, zone.bounds));
}

/**
 * Simple point-in-polygon test
 */
function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: GeoJSON.Polygon
): boolean {
  const coords = polygon.coordinates[0]; // Exterior ring
  let inside = false;

  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0];
    const yi = coords[i][1];
    const xj = coords[j][0];
    const yj = coords[j][1];

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Merge overlapping zones with similar coefficients
 */
export function mergeZones(
  zones: TerrainZone[],
  toleranceDiff: number = 0.5
): TerrainZone[] {
  // Simple implementation: group by similar coefficients
  const grouped = new Map<string, TerrainZone[]>();

  zones.forEach((zone) => {
    const key = Math.floor(zone.coefficient / toleranceDiff).toString();
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(zone);
  });

  // Return first zone from each group as representative
  // In production, would merge actual polygons
  return Array.from(grouped.values()).map((group) => group[0]);
}

/**
 * Get zone statistics for an area
 */
export function getZoneStatistics(zones: TerrainZone[]) {
  const stats = {
    total: zones.length,
    byType: {} as Record<string, number>,
    avgCoefficient: 0,
    coefficientDistribution: {
      excellent: 0, // 1.0-2.0
      good: 0, // 2.0-3.0
      moderate: 0, // 3.0-4.0
      difficult: 0, // 4.0-5.0
      veryDifficult: 0, // 5.0-7.0
      extreme: 0, // 7.0-10.0
    },
  };

  let totalCoeff = 0;

  zones.forEach((zone) => {
    // Count by type
    stats.byType[zone.terrainType] = (stats.byType[zone.terrainType] || 0) + 1;

    // Sum coefficients
    totalCoeff += zone.coefficient;

    // Distribution
    if (zone.coefficient <= 2.0) stats.coefficientDistribution.excellent++;
    else if (zone.coefficient <= 3.0) stats.coefficientDistribution.good++;
    else if (zone.coefficient <= 4.0) stats.coefficientDistribution.moderate++;
    else if (zone.coefficient <= 5.0) stats.coefficientDistribution.difficult++;
    else if (zone.coefficient <= 7.0) stats.coefficientDistribution.veryDifficult++;
    else stats.coefficientDistribution.extreme++;
  });

  stats.avgCoefficient = zones.length > 0 ? totalCoeff / zones.length : 0;

  return stats;
}
