import type { OverpassElement, OverpassResponse } from './overpass';

/**
 * Convert Overpass response to GeoJSON
 */
export function overpassToGeoJSON(data: OverpassResponse): GeoJSON.FeatureCollection {
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  const features: GeoJSON.Feature[] = [];

  // First pass: collect all nodes
  data.elements.forEach((element) => {
    if (element.type === 'node' && element.lat && element.lon) {
      nodeMap.set(element.id, { lat: element.lat, lon: element.lon });
    }
  });

  // Second pass: create features
  data.elements.forEach((element) => {
    if (element.type === 'way' && element.nodes) {
      const coordinates: [number, number][] = [];

      element.nodes.forEach((nodeId) => {
        const node = nodeMap.get(nodeId);
        if (node) {
          coordinates.push([node.lon, node.lat]);
        }
      });

      if (coordinates.length > 0) {
        features.push({
          type: 'Feature',
          id: element.id,
          properties: {
            osmId: element.id,
            type: element.type,
            ...element.tags,
          },
          geometry: {
            type: 'LineString',
            coordinates,
          },
        });
      }
    } else if (element.type === 'node' && element.lat && element.lon) {
      features.push({
        type: 'Feature',
        id: element.id,
        properties: {
          osmId: element.id,
          type: element.type,
          ...element.tags,
        },
        geometry: {
          type: 'Point',
          coordinates: [element.lon, element.lat],
        },
      });
    }
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Classify OSM feature type
 */
export function classifyFeature(tags: Record<string, string> = {}): string {
  // Water features
  if (tags.natural === 'water' || tags.waterway) return 'water';
  if (tags.natural === 'wetland') return 'wetland';

  // Vegetation
  if (tags.natural === 'wood' || tags.landuse === 'forest') return 'forest';
  if (tags.natural === 'grassland') return 'grassland';
  if (tags.natural === 'scrub') return 'scrub';

  // Paths and trails
  if (tags.highway === 'path') return 'path';
  if (tags.highway === 'footway') return 'footway';
  if (tags.highway === 'track') return 'track';
  if (tags.highway === 'bridleway') return 'bridleway';
  if (tags.highway === 'cycleway') return 'cycleway';
  if (tags.route === 'hiking') return 'hiking_route';

  // Default
  return 'unknown';
}

/**
 * Extract trail segments from Overpass data
 */
export function extractTrailSegments(data: OverpassResponse) {
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  const segments: Array<{
    id: number;
    name?: string;
    type: string;
    coordinates: Array<{ lat: number; lng: number }>;
    tags: Record<string, string>;
  }> = [];

  // Collect nodes
  data.elements.forEach((element) => {
    if (element.type === 'node' && element.lat && element.lon) {
      nodeMap.set(element.id, { lat: element.lat, lon: element.lon });
    }
  });

  // Extract trail ways
  data.elements.forEach((element) => {
    if (element.type === 'way' && element.nodes && element.tags?.highway) {
      const coordinates: Array<{ lat: number; lng: number }> = [];

      element.nodes.forEach((nodeId) => {
        const node = nodeMap.get(nodeId);
        if (node) {
          coordinates.push({ lat: node.lat, lng: node.lon });
        }
      });

      if (coordinates.length > 1) {
        segments.push({
          id: element.id,
          name: element.tags.name,
          type: classifyFeature(element.tags),
          coordinates,
          tags: element.tags,
        });
      }
    }
  });

  return segments;
}
