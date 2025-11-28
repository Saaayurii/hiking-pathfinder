/**
 * Elevation data utilities using Open-Elevation API
 * Free alternative to Mapbox Terrain RGB
 * API: https://open-elevation.com/
 *
 * Note: Open-Elevation can be slow/unreliable, falls back to approximate elevation
 */

export interface ElevationPoint {
  latitude: number;
  longitude: number;
  elevation: number;
}

const OPEN_ELEVATION_API = 'https://api.open-elevation.com/api/v1/lookup';
const FETCH_TIMEOUT = 8000; // 8 second timeout per request (increased from 5s)
const BATCH_SIZE = 50; // Reduced from 100 to 50 for better reliability

/**
 * Fetch elevation data for multiple points
 * Using smaller batches for better reliability
 */
export async function fetchElevations(
  points: Array<{ lat: number; lng: number }>
): Promise<number[]> {
  try {
    // Split into smaller chunks for better reliability
    const chunks = chunkArray(points, BATCH_SIZE);
    const allElevations: number[] = [];

    console.log(`📡 Fetching elevation data: ${chunks.length} requests for ${points.length} points`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const locations = chunk.map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
      }));

      console.log(`  Request ${i + 1}/${chunks.length}: fetching ${chunk.length} points...`);

      try {
        // Add timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(OPEN_ELEVATION_API, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ locations }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Elevation API error: ${response.statusText}`);
        }

        const data = await response.json();
        const elevations = data.results.map((r: ElevationPoint) => r.elevation);
        allElevations.push(...elevations);

        console.log(`  ✓ Received ${elevations.length} elevations (${allElevations.length}/${points.length} total)`);
      } catch (chunkError) {
        console.warn(`  ⚠️  Timeout or error for chunk ${i + 1}, using approximate elevation (200m)`);
        // Use approximate elevation if API fails
        const approximateElevations = new Array(chunk.length).fill(200);
        allElevations.push(...approximateElevations);
      }

      // Rate limiting: wait 200ms between requests (increased from 100ms)
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    console.log(`✅ All elevation data fetched: ${allElevations.length} points`);
    return allElevations;
  } catch (error) {
    console.error('Error fetching elevation data:', error);
    // Return zeros as fallback
    return new Array(points.length).fill(0);
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
