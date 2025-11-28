/**
 * OSM terrain data processing for pathfinding
 */

import type { OverpassElement, OverpassResponse } from './overpass';

export interface TerrainFeature {
  type: 'building' | 'barrier' | 'water' | 'forest' | 'grassland' | 'path' | 'road' | 'scrub' | 'rock' | 'wetland' | 'railway';
  geometry: Array<{ lat: number; lng: number }>;
  tags: Record<string, string>;
  passable: boolean;
  coefficient: number;
}

/**
 * Extract terrain features from OSM data
 */
export function extractTerrainFeatures(osmData: OverpassResponse): TerrainFeature[] {
  const features: TerrainFeature[] = [];
  const nodeMap = new Map<number, { lat: number; lng: number }>();

  // First, build a map of all nodes
  for (const element of osmData.elements) {
    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      nodeMap.set(element.id, { lat: element.lat, lng: element.lon });
    }
  }

  // Process ways and relations
  for (const element of osmData.elements) {
    if (element.type === 'way' && element.nodes) {
      const geometry: Array<{ lat: number; lng: number }> = [];

      for (const nodeId of element.nodes) {
        const node = nodeMap.get(nodeId);
        if (node) {
          geometry.push(node);
        }
      }

      if (geometry.length < 2) continue;

      const tags = element.tags || {};
      const feature = classifyFeature(tags, geometry);

      if (feature) {
        features.push(feature);
      }
    }
  }

  return features;
}

/**
 * Classify feature based on OSM tags
 */
function classifyFeature(
  tags: Record<string, string>,
  geometry: Array<{ lat: number; lng: number }>
): TerrainFeature | null {
  // Buildings - impassable
  if (tags.building) {
    return {
      type: 'building',
      geometry,
      tags,
      passable: false,
      coefficient: 100, // Effectively impassable
    };
  }

  // Barriers
  if (tags.barrier) {
    const barrier = tags.barrier;
    if (['wall', 'fence', 'hedge', 'city_wall'].includes(barrier)) {
      return {
        type: 'barrier',
        geometry,
        tags,
        passable: false,
        coefficient: 100,
      };
    }
  }

  // Water - impassable
  if (tags.natural === 'water' || tags.waterway || tags.natural === 'wetland') {
    return {
      type: 'water',
      geometry,
      tags,
      passable: false,
      coefficient: 100,
    };
  }

  // Railways - impassable
  if (tags.railway) {
    return {
      type: 'railway',
      geometry,
      tags,
      passable: false,
      coefficient: 100,
    };
  }

  // Paths and roads - walkable
  if (tags.highway) {
    const highway = tags.highway;
    let coefficient = 3.0;

    if (['path', 'footway', 'bridleway'].includes(highway)) {
      coefficient = 1.0; // Easy walking
    } else if (['track', 'cycleway'].includes(highway)) {
      coefficient = 1.5;
    } else if (highway === 'steps') {
      coefficient = 2.5;
    } else if (['residential', 'service', 'unclassified'].includes(highway)) {
      coefficient = 2.0;
    }

    return {
      type: 'path',
      geometry,
      tags,
      passable: true,
      coefficient,
    };
  }

  // Forest - harder walking
  if (tags.natural === 'wood' || tags.landuse === 'forest') {
    return {
      type: 'forest',
      geometry,
      tags,
      passable: true,
      coefficient: 4.0,
    };
  }

  // Grassland - easy
  if (tags.natural === 'grassland') {
    return {
      type: 'grassland',
      geometry,
      tags,
      passable: true,
      coefficient: 2.0,
    };
  }

  // Scrub - difficult
  if (tags.natural === 'scrub' || tags.natural === 'heath') {
    return {
      type: 'scrub',
      geometry,
      tags,
      passable: true,
      coefficient: 5.0,
    };
  }

  // Rock - very difficult
  if (tags.natural === 'bare_rock' || tags.natural === 'scree') {
    return {
      type: 'rock',
      geometry,
      tags,
      passable: true,
      coefficient: 6.0,
    };
  }

  return null;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Find terrain coefficient for a specific point
 * Also checks nearby features with buffer zone
 */
export function getTerrainCoefficientAtPoint(
  point: { lat: number; lng: number },
  features: TerrainFeature[]
): { type: string; coefficient: number; passable: boolean } {
  const BUFFER_METERS = 5; // 5 meter buffer around impassable features

  // Check if point is inside any impassable feature (buildings, water, etc.)
  for (const feature of features) {
    if (!feature.passable) {
      // Check direct containment
      if (isPointInPolygon(point, feature.geometry)) {
        return {
          type: feature.type,
          coefficient: feature.coefficient,
          passable: false,
        };
      }

      // Check proximity to edges (buffer zone)
      for (let i = 0; i < feature.geometry.length - 1; i++) {
        const dist = distanceToLineSegment(
          point,
          feature.geometry[i],
          feature.geometry[i + 1]
        );

        if (dist < BUFFER_METERS) {
          // Close to impassable feature - increase coefficient significantly
          return {
            type: `${feature.type}-buffer`,
            coefficient: 50, // High cost but not impossible
            passable: true, // Technically passable but discouraged
          };
        }
      }
    }
  }

  // Check if point is inside any terrain feature
  for (const feature of features) {
    if (feature.passable && isPointInPolygon(point, feature.geometry)) {
      return {
        type: feature.type,
        coefficient: feature.coefficient,
        passable: true,
      };
    }
  }

  // Default: open ground
  return {
    type: 'unknown',
    coefficient: 3.0,
    passable: true,
  };
}

/**
 * Distance from point to line segment (for proximity checks)
 */
export function distanceToLineSegment(
  point: { lat: number; lng: number },
  lineStart: { lat: number; lng: number },
  lineEnd: { lat: number; lng: number }
): number {
  const A = point.lng - lineStart.lng;
  const B = point.lat - lineStart.lat;
  const C = lineEnd.lng - lineStart.lng;
  const D = lineEnd.lat - lineStart.lat;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lineStart.lng;
    yy = lineStart.lat;
  } else if (param > 1) {
    xx = lineEnd.lng;
    yy = lineEnd.lat;
  } else {
    xx = lineStart.lng + param * C;
    yy = lineStart.lat + param * D;
  }

  const dx = point.lng - xx;
  const dy = point.lat - yy;

  // Convert to approximate meters
  const metersPerDegreeLat = 111000;
  const metersPerDegreeLng = 111000 * Math.cos((point.lat * Math.PI) / 180);

  const dxMeters = dx * metersPerDegreeLng;
  const dyMeters = dy * metersPerDegreeLat;

  return Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);
}
