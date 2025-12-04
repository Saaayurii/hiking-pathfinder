/**
 * Overpass API client for fetching OpenStreetMap data
 * Documentation: https://wiki.openstreetmap.org/wiki/Overpass_API
 */

import { osmCache } from '@/lib/cache/memoryCache';
import MemoryCache from '@/lib/cache/memoryCache';

export interface OverpassBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  members?: Array<{
    type: string;
    ref: number;
    role: string;
  }>;
  geometry?: Array<{ lat: number; lon: number }>;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

// Multiple Overpass API servers for fallback
const OVERPASS_SERVERS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Cache TTL: 10 minutes for OSM data
const CACHE_TTL = 600;

/**
 * Build Overpass QL query for hiking trails and terrain features
 */
export function buildTrailQuery(bounds: OverpassBounds): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

  return `
    [out:json][timeout:25];
    (
      // Hiking trails and paths
      way["highway"~"path|footway|track|bridleway|cycleway"]["access"!="private"](${bbox});
      way["route"="hiking"](${bbox});

      // Water features (rivers, lakes, wetlands)
      way["natural"="water"](${bbox});
      way["waterway"~"river|stream|canal"](${bbox});
      way["natural"="wetland"](${bbox});

      // Terrain features
      way["natural"="wood"](${bbox});
      way["landuse"="forest"](${bbox});
      way["natural"="grassland"](${bbox});
      way["natural"="scrub"](${bbox});

      // Additional trail info
      node["tourism"="information"]["information"="guidepost"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `.trim();
}

/**
 * Build Overpass QL query for pathfinding with obstacles and terrain
 */
export function buildPathfindingQuery(bounds: OverpassBounds): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

  return `
    [out:json][timeout:30];
    (
      // Buildings - impassable
      way["building"](${bbox});
      relation["building"](${bbox});

      // Barriers - impassable or difficult
      way["barrier"~"wall|fence|hedge|city_wall"](${bbox});
      node["barrier"~"gate|lift_gate|stile|kissing_gate"](${bbox});

      // Roads and paths - walkable with different coefficients
      way["highway"~"path|footway|track|bridleway|cycleway|steps"](${bbox});
      way["highway"~"residential|service|unclassified"]["foot"!="no"](${bbox});

      // Natural terrain - different walking difficulty
      way["natural"="wood"](${bbox});
      way["landuse"="forest"](${bbox});
      way["natural"="grassland"](${bbox});
      way["natural"="scrub"](${bbox});
      way["natural"="heath"](${bbox});
      way["natural"="bare_rock"](${bbox});
      way["natural"="scree"](${bbox});

      // Water - impassable
      way["natural"="water"](${bbox});
      way["waterway"~"river|stream|canal|ditch"](${bbox});
      way["natural"="wetland"](${bbox});

      // Railways - impassable
      way["railway"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `.trim();
}

/**
 * Fetch data from Overpass API with caching, multiple servers, and retry logic
 */
export async function fetchOverpassData(
  bounds: OverpassBounds,
  usePathfindingQuery = false,
  retries = 1
): Promise<OverpassResponse> {
  // Check cache first
  const cacheKey = MemoryCache.boundsKey(bounds, usePathfindingQuery ? 'pathfinding' : 'trail');
  const cached = osmCache.get<OverpassResponse>(cacheKey);
  if (cached) {
    console.log('  ✓ Using cached OSM data');
    return cached;
  }

  const query = usePathfindingQuery ? buildPathfindingQuery(bounds) : buildTrailQuery(bounds);

  // Try each server
  for (let serverIndex = 0; serverIndex < OVERPASS_SERVERS.length; serverIndex++) {
    const serverUrl = OVERPASS_SERVERS[serverIndex];

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout (reduced from 15s)

        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.statusText}`);
        }

        const data: OverpassResponse = await response.json();

        // Cache successful response
        osmCache.set(cacheKey, data, CACHE_TTL);
        console.log(`  ✓ OSM data fetched from ${new URL(serverUrl).hostname}`);

        return data;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        const isLastServer = serverIndex === OVERPASS_SERVERS.length - 1;

        if (!isLastAttempt) {
          console.warn(`  Overpass API attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Quick retry
          continue;
        }

        if (!isLastServer) {
          console.warn(`  Server ${new URL(serverUrl).hostname} failed, trying next server...`);
          break; // Try next server
        }

        console.error('Error fetching Overpass data after all retries:', error);
        throw error;
      }
    }
  }

  throw new Error('Failed to fetch Overpass data from all servers');
}

/**
 * Parse trail attributes from OSM tags
 */
export function parseTrailAttributes(tags: Record<string, string> = {}) {
  return {
    surface: tags.surface || 'unknown',
    smoothness: tags.smoothness || 'unknown',
    visibility: tags.trail_visibility || tags.visibility || 'unknown',
    width: tags.width ? parseFloat(tags.width) : undefined,
    incline: tags.incline || undefined,
    informal: tags.informal === 'yes',
    trailType: tags.highway || tags.route || 'unknown',
    access: tags.access || 'yes',
    name: tags.name || undefined,
    difficulty: tags.sac_scale || tags['mtb:scale'] || undefined,
  };
}

/**
 * Calculate bounds from center point and radius (in meters)
 */
export function calculateBounds(
  center: { lat: number; lng: number },
  radiusMeters: number = 5000
): OverpassBounds {
  // Rough conversion: 1 degree latitude ≈ 111km
  // Longitude varies by latitude
  const latOffset = radiusMeters / 111000;
  const lngOffset = radiusMeters / (111000 * Math.cos((center.lat * Math.PI) / 180));

  return {
    south: center.lat - latOffset,
    north: center.lat + latOffset,
    west: center.lng - lngOffset,
    east: center.lng + lngOffset,
  };
}
