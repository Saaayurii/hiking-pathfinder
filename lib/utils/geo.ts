/**
 * Geographic utility functions
 */

/**
 * Haversine distance formula (in meters)
 */
export function calculateDistance(
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
 * Calculate bearing between two points (in degrees)
 */
export function calculateBearing(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;

  return bearing;
}

/**
 * Calculate destination point given distance and bearing
 */
export function calculateDestination(
  point: { lat: number; lng: number },
  distance: number,
  bearing: number
): { lat: number; lng: number } {
  const R = 6371000;
  const δ = distance / R;
  const θ = (bearing * Math.PI) / 180;
  const φ1 = (point.lat * Math.PI) / 180;
  const λ1 = (point.lng * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );

  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (λ2 * 180) / Math.PI,
  };
}

/**
 * Check if point is within bounding box
 */
export function isPointInBounds(
  point: { lat: number; lng: number },
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

/**
 * Get bounding box from array of points
 */
export function getBoundsFromPoints(
  points: Array<{ lat: number; lng: number }>
): { north: number; south: number; east: number; west: number } {
  if (points.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }

  let north = points[0].lat;
  let south = points[0].lat;
  let east = points[0].lng;
  let west = points[0].lng;

  for (const point of points) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }

  return { north, south, east, west };
}

/**
 * Expand bounding box by a margin (in meters)
 */
export function expandBounds(
  bounds: { north: number; south: number; east: number; west: number },
  marginMeters: number
): { north: number; south: number; east: number; west: number } {
  const latMargin = marginMeters / 111000;
  const avgLat = (bounds.north + bounds.south) / 2;
  const lngMargin = marginMeters / (111000 * Math.cos((avgLat * Math.PI) / 180));

  return {
    north: bounds.north + latMargin,
    south: bounds.south - latMargin,
    east: bounds.east + lngMargin,
    west: bounds.west - lngMargin,
  };
}
