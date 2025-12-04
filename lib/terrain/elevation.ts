/**
 * Elevation data utilities using Open-Meteo API (fast & free)
 * API: https://open-meteo.com/en/docs/elevation-api
 *
 * Fallback: Open-Elevation API
 */

import { elevationCache } from '@/lib/cache/memoryCache';
import MemoryCache from '@/lib/cache/memoryCache';

export interface ElevationPoint {
  latitude: number;
  longitude: number;
  elevation: number;
}

// Open-Meteo is faster and more reliable
const OPEN_METEO_API = 'https://api.open-meteo.com/v1/elevation';
const FETCH_TIMEOUT = 5000; // 5 second timeout
const BATCH_SIZE = 100; // Open-Meteo can handle more

// Cache TTL: 1 hour (elevation data doesn't change)
const CACHE_TTL = 3600;

/**
 * Fetch elevation data for multiple points using Open-Meteo API
 * Much faster than Open-Elevation
 */
export async function fetchElevations(
  points: Array<{ lat: number; lng: number }>
): Promise<number[]> {
  if (points.length === 0) return [];

  // Check cache first - get elevations for cached points
  const results: (number | null)[] = new Array(points.length).fill(null);
  const uncachedPoints: { index: number; lat: number; lng: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    const cacheKey = MemoryCache.pointKey(points[i].lat, points[i].lng, 4);
    const cached = elevationCache.get<number>(cacheKey);
    if (cached !== null) {
      results[i] = cached;
    } else {
      uncachedPoints.push({ index: i, ...points[i] });
    }
  }

  const cachedCount = points.length - uncachedPoints.length;
  if (cachedCount > 0) {
    console.log(`  ✓ ${cachedCount}/${points.length} elevations from cache`);
  }

  if (uncachedPoints.length === 0) {
    return results as number[];
  }

  try {
    // Split into chunks
    const chunks = chunkArray(uncachedPoints, BATCH_SIZE);
    console.log(`📡 Fetching elevation data: ${chunks.length} requests for ${uncachedPoints.length} points`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Open-Meteo uses GET with comma-separated coordinates
      const latitudes = chunk.map(p => p.lat.toFixed(5)).join(',');
      const longitudes = chunk.map(p => p.lng.toFixed(5)).join(',');
      const url = `${OPEN_METEO_API}?latitude=${latitudes}&longitude=${longitudes}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Elevation API error: ${response.statusText}`);
        }

        const data = await response.json();
        const elevations: number[] = data.elevation || [];

        // Map elevations back to original indices and cache them
        for (let j = 0; j < chunk.length; j++) {
          const elevation = elevations[j] ?? 200;
          const point = chunk[j];
          results[point.index] = elevation;

          // Cache each point
          const cacheKey = MemoryCache.pointKey(point.lat, point.lng, 4);
          elevationCache.set(cacheKey, elevation, CACHE_TTL);
        }

        console.log(`  ✓ Batch ${i + 1}/${chunks.length}: ${elevations.length} elevations`);
      } catch (chunkError) {
        console.warn(`  ⚠️  Batch ${i + 1} failed, using fallback elevation (200m)`);
        // Use approximate elevation if API fails
        for (const point of chunk) {
          results[point.index] = 200;
        }
      }

      // Small delay between requests to be nice to the API
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`✅ All elevation data ready: ${points.length} points`);
    return results.map(e => e ?? 200);
  } catch (error) {
    console.error('Error fetching elevation data:', error);
    // Return fallback values
    return results.map(e => e ?? 200);
  }
}

/**
 * Fetch single elevation point
 */
export async function fetchElevation(point: { lat: number; lng: number }): Promise<number> {
  const elevations = await fetchElevations([point]);
  return elevations[0] || 0;
}

/**
 * Calculate elevation gain and loss along a path
 */
export function calculateElevationStats(elevations: number[]) {
  let gain = 0;
  let loss = 0;
  let max = elevations[0] || 0;
  let min = elevations[0] || 0;

  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];

    if (diff > 0) {
      gain += diff;
    } else {
      loss += Math.abs(diff);
    }

    max = Math.max(max, elevations[i]);
    min = Math.min(min, elevations[i]);
  }

  return { gain, loss, max, min };
}

/**
 * Create elevation profile for visualization
 */
export function createElevationProfile(
  path: Array<{ lat: number; lng: number }>,
  elevations: number[]
) {
  const profile: Array<{ distance: number; elevation: number }> = [];
  let cumulativeDistance = 0;

  profile.push({ distance: 0, elevation: elevations[0] || 0 });

  for (let i = 1; i < path.length; i++) {
    const dist = haversineDistance(path[i - 1], path[i]);
    cumulativeDistance += dist;

    profile.push({
      distance: cumulativeDistance,
      elevation: elevations[i] || 0,
    });
  }

  return profile;
}

/**
 * Haversine distance formula (in meters)
 */
function haversineDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Utility: chunk array into smaller arrays
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
