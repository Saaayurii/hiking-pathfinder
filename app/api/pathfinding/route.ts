import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { PathfindingResponse } from '@/types/api';

const PathfindingRequestSchema = z.object({
  start: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  end: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  options: z.object({
    gridSizeMeters: z.number().optional(),
  }).optional(),
});

// Simple elevation cache
const elevationCache = new Map<string, number>();

/**
 * Fast pathfinding - creates direct route with elevation data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = PathfindingRequestSchema.parse(body);
    const { start, end } = validated;

    console.log('🗺️  Fast pathfinding...');
    console.log(`  Start: ${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`);
    console.log(`  End: ${end.lat.toFixed(5)}, ${end.lng.toFixed(5)}`);

    // Calculate distance
    const distance = haversineDistance(start, end);
    console.log(`  Distance: ${(distance / 1000).toFixed(2)}km`);

    // Determine number of waypoints based on distance
    const numPoints = Math.max(10, Math.min(50, Math.ceil(distance / 100)));

    // Generate path points along straight line
    const pathPoints: Array<{ lat: number; lng: number; elevation: number }> = [];

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const lat = start.lat + (end.lat - start.lat) * t;
      const lng = start.lng + (end.lng - start.lng) * t;
      pathPoints.push({ lat, lng, elevation: 0 });
    }

    // Fetch elevations in one batch
    const elevations = await fetchElevationsBatch(pathPoints);
    for (let i = 0; i < pathPoints.length; i++) {
      pathPoints[i].elevation = elevations[i];
    }

    // Calculate statistics
    const stats = calculateRouteStats(pathPoints, distance);

    console.log(`✅ Route calculated in ${numPoints + 1} points`);

    const response: PathfindingResponse = {
      success: true,
      route: {
        name: 'Прямой маршрут',
        start,
        end,
        path: pathPoints,
        distance,
        duration: stats.duration,
        elevation: {
          gain: stats.elevationGain,
          loss: stats.elevationLoss,
          max: stats.maxElevation,
          min: stats.minElevation,
          profile: stats.profile,
        },
        terrainFeatures: [], // No terrain features for fast mode
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Pathfinding error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Fetch elevations using Open-Meteo API (fast)
 */
async function fetchElevationsBatch(
  points: Array<{ lat: number; lng: number }>
): Promise<number[]> {
  // Check cache first
  const results: number[] = new Array(points.length).fill(200);
  const uncached: { index: number; lat: number; lng: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    const key = `${points[i].lat.toFixed(4)},${points[i].lng.toFixed(4)}`;
    const cached = elevationCache.get(key);
    if (cached !== undefined) {
      results[i] = cached;
    } else {
      uncached.push({ index: i, ...points[i] });
    }
  }

  if (uncached.length === 0) {
    return results;
  }

  try {
    // Open-Meteo API - fast and reliable
    const latitudes = uncached.map(p => p.lat.toFixed(5)).join(',');
    const longitudes = uncached.map(p => p.lng.toFixed(5)).join(',');
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const elevations: number[] = data.elevation || [];

      for (let i = 0; i < uncached.length; i++) {
        const elevation = elevations[i] ?? 200;
        const point = uncached[i];
        results[point.index] = elevation;

        // Cache
        const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
        elevationCache.set(key, elevation);
      }
    }
  } catch (error) {
    console.warn('Elevation fetch failed, using defaults');
  }

  return results;
}

/**
 * Calculate route statistics
 */
function calculateRouteStats(
  path: Array<{ lat: number; lng: number; elevation: number }>,
  totalDistance: number
) {
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxElevation = path[0]?.elevation || 0;
  let minElevation = path[0]?.elevation || 0;

  const profile: Array<{ distance: number; elevation: number }> = [];
  let cumulativeDistance = 0;

  for (let i = 0; i < path.length; i++) {
    const point = path[i];

    if (i > 0) {
      const prev = path[i - 1];
      const segmentDist = haversineDistance(prev, point);
      cumulativeDistance += segmentDist;

      const elevDiff = point.elevation - prev.elevation;
      if (elevDiff > 0) {
        elevationGain += elevDiff;
      } else {
        elevationLoss += Math.abs(elevDiff);
      }
    }

    maxElevation = Math.max(maxElevation, point.elevation);
    minElevation = Math.min(minElevation, point.elevation);

    profile.push({
      distance: cumulativeDistance,
      elevation: point.elevation,
    });
  }

  // Hiking speed: ~4 km/h base, slower uphill
  const baseSpeed = 4000; // m/h
  const uphillPenalty = elevationGain * 10; // 10 seconds per meter of climb
  const baseDuration = (totalDistance / baseSpeed) * 3600;
  const duration = baseDuration + uphillPenalty;

  return {
    elevationGain,
    elevationLoss,
    maxElevation,
    minElevation,
    duration,
    profile,
  };
}

/**
 * Haversine distance in meters
 */
function haversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R = 6371000;
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
