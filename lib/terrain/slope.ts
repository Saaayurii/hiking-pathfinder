/**
 * Slope calculation utilities for terrain analysis
 */

/**
 * Calculate slope between two points in degrees
 */
export function calculateSlope(
  point1: { lat: number; lng: number; elevation: number },
  point2: { lat: number; lng: number; elevation: number }
): number {
  const distance = haversineDistance(point1, point2);
  const elevationChange = Math.abs(point2.elevation - point1.elevation);

  if (distance === 0) return 0;

  // Calculate slope angle in degrees
  const slopeRadians = Math.atan(elevationChange / distance);
  const slopeDegrees = (slopeRadians * 180) / Math.PI;

  return slopeDegrees;
}

/**
 * Calculate slope percentage
 */
export function calculateSlopePercentage(
  point1: { lat: number; lng: number; elevation: number },
  point2: { lat: number; lng: number; elevation: number }
): number {
  const distance = haversineDistance(point1, point2);
  const elevationChange = Math.abs(point2.elevation - point1.elevation);

  if (distance === 0) return 0;

  return (elevationChange / distance) * 100;
}

/**
 * Classify slope difficulty
 */
export function classifySlope(slopeDegrees: number): {
  category: string;
  difficulty: 'easy' | 'moderate' | 'difficult' | 'very_difficult' | 'extreme';
} {
  if (slopeDegrees < 5) {
    return { category: 'flat', difficulty: 'easy' };
  } else if (slopeDegrees < 10) {
    return { category: 'gentle', difficulty: 'easy' };
  } else if (slopeDegrees < 15) {
    return { category: 'moderate', difficulty: 'moderate' };
  } else if (slopeDegrees < 25) {
    return { category: 'steep', difficulty: 'difficult' };
  } else if (slopeDegrees < 35) {
    return { category: 'very_steep', difficulty: 'very_difficult' };
  } else {
    return { category: 'extreme', difficulty: 'extreme' };
  }
}

/**
 * Calculate slope factor for pathfinding
 * Steeper slopes increase walking time
 */
export function getSlopeFactor(slopeDegrees: number, isUphill: boolean): number {
  const absSlope = Math.abs(slopeDegrees);

  // Tobler's hiking function approximation
  // Optimal speed at -5 degrees (slight downhill)
  // Speed decreases significantly on steep uphills and downhills

  if (isUphill) {
    if (absSlope < 5) return 1.0;
    if (absSlope < 10) return 1.3;
    if (absSlope < 15) return 1.8;
    if (absSlope < 20) return 2.5;
    if (absSlope < 25) return 3.5;
    if (absSlope < 30) return 5.0;
    return 7.0; // Very steep uphill
  } else {
    // Downhill
    if (absSlope < 5) return 0.9; // Slight downhill is fastest
    if (absSlope < 10) return 1.0;
    if (absSlope < 15) return 1.2;
    if (absSlope < 20) return 1.5;
    if (absSlope < 25) return 2.0;
    if (absSlope < 30) return 3.0;
    return 4.0; // Very steep downhill is slow and dangerous
  }
}

/**
 * Check if slope is walkable
 */
export function isWalkable(slopeDegrees: number, maxSlope: number = 35): boolean {
  return Math.abs(slopeDegrees) <= maxSlope;
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
 * Calculate average slope for a path segment
 */
export function calculateAverageSlope(
  points: Array<{ lat: number; lng: number; elevation: number }>
): number {
  if (points.length < 2) return 0;

  let totalSlope = 0;
  let count = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const slope = calculateSlope(points[i], points[i + 1]);
    totalSlope += slope;
    count++;
  }

  return count > 0 ? totalSlope / count : 0;
}
