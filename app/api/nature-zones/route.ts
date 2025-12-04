import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Multiple Overpass servers for reliability
const OVERPASS_SERVERS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// In-memory cache for nature zones
const zonesCache = new Map<string, { data: NatureZone[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface NatureZone {
  id: number;
  type: 'water' | 'forest' | 'wetland' | 'grassland';
  name?: string;
  geometry: Array<{ lat: number; lng: number }>;
}

const RequestSchema = z.object({
  bounds: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }),
});

/**
 * Build optimized Overpass query - only essential data
 */
function buildNatureZonesQuery(bounds: { north: number; south: number; east: number; west: number }): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

  // Simplified query - only the most important features
  return `
    [out:json][timeout:15];
    (
      way["natural"="water"](${bbox});
      way["landuse"="forest"](${bbox});
      way["natural"="wood"](${bbox});
      way["natural"="wetland"](${bbox});
    );
    out geom;
  `.trim();
}

/**
 * Parse Overpass response into NatureZone objects
 */
function parseNatureZones(elements: any[]): NatureZone[] {
  const zones: NatureZone[] = [];

  for (const element of elements) {
    if (!element.geometry || element.geometry.length < 3) continue;

    const tags = element.tags || {};
    let type: NatureZone['type'] = 'grassland';

    if (tags.natural === 'water' || tags.water || tags.waterway) {
      type = 'water';
    } else if (tags.natural === 'wood' || tags.landuse === 'forest') {
      type = 'forest';
    } else if (tags.natural === 'wetland') {
      type = 'wetland';
    }

    const geometry = element.geometry.map((p: { lat: number; lon: number }) => ({
      lat: p.lat,
      lng: p.lon,
    }));

    zones.push({
      id: element.id,
      type,
      name: tags.name,
      geometry,
    });
  }

  return zones;
}

/**
 * Generate cache key from bounds
 */
function getCacheKey(bounds: { north: number; south: number; east: number; west: number }): string {
  // Round to 2 decimal places for better cache hits
  return `${bounds.south.toFixed(2)},${bounds.west.toFixed(2)},${bounds.north.toFixed(2)},${bounds.east.toFixed(2)}`;
}

/**
 * Fetch zones from Overpass with fallback servers
 */
async function fetchZonesFromOverpass(bounds: { north: number; south: number; east: number; west: number }): Promise<NatureZone[]> {
  const query = buildNatureZonesQuery(bounds);

  for (const serverUrl of OVERPASS_SERVERS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const zones = parseNatureZones(data.elements || []);
        console.log(`🌲 Fetched ${zones.length} nature zones from ${new URL(serverUrl).hostname}`);
        return zones;
      }
    } catch (error) {
      console.warn(`Nature zones: ${new URL(serverUrl).hostname} failed, trying next...`);
    }
  }

  return [];
}

/**
 * POST /api/nature-zones
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = RequestSchema.parse(body);
    const { bounds } = validated;

    // Check cache
    const cacheKey = getCacheKey(bounds);
    const cached = zonesCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`🌲 Returning ${cached.data.length} cached nature zones`);
      return NextResponse.json({
        success: true,
        data: { zones: cached.data, count: cached.data.length, cached: true },
      });
    }

    // Fetch from Overpass
    const zones = await fetchZonesFromOverpass(bounds);

    // Cache result
    zonesCache.set(cacheKey, { data: zones, timestamp: Date.now() });

    // Limit cache size
    if (zonesCache.size > 50) {
      const oldest = Array.from(zonesCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 25);
      for (const [key] of oldest) {
        zonesCache.delete(key);
      }
    }

    return NextResponse.json({
      success: true,
      data: { zones, count: zones.length },
    });
  } catch (error) {
    console.error('Nature zones error:', error);
    return NextResponse.json({
      success: true, // Return success with empty zones instead of error
      data: { zones: [], count: 0 },
    });
  }
}

/**
 * GET /api/nature-zones
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const boundsStr = searchParams.get('bounds');

    if (!boundsStr) {
      return NextResponse.json({ success: false, error: 'Missing bounds' }, { status: 400 });
    }

    const [south, west, north, east] = boundsStr.split(',').map(Number);
    if ([south, west, north, east].some(isNaN)) {
      return NextResponse.json({ success: false, error: 'Invalid bounds' }, { status: 400 });
    }

    const bounds = { north, south, east, west };
    const cacheKey = getCacheKey(bounds);
    const cached = zonesCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: { zones: cached.data, count: cached.data.length },
      });
    }

    const zones = await fetchZonesFromOverpass(bounds);
    zonesCache.set(cacheKey, { data: zones, timestamp: Date.now() });

    return NextResponse.json({
      success: true,
      data: { zones, count: zones.length },
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      data: { zones: [], count: 0 },
    });
  }
}
